import './env.js'
import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Pool, type PoolConfig } from 'pg'

export type RagChunk = {
  id: string
  namespace: string
  source: string
  title: string
  content: string
  score: number
}

type RagChunkRow = {
  id: string
  namespace: string
  source: string
  title: string
  content: string
  embedding: number[]
  vector_score?: number | string | null
}

const defaultDatabaseName = 'exercise_monitor'
const embeddingDimensions = 128
let pool: Pool | null = null
let initialized = false
let pgVectorAvailable = false

export async function initRagStore() {
  const db = getPool()
  await db.query(`
    CREATE TABLE IF NOT EXISTS app_rag_chunks (
      id uuid PRIMARY KEY,
      namespace text NOT NULL DEFAULT 'health',
      source text NOT NULL,
      title text NOT NULL,
      chunk_index integer NOT NULL,
      content text NOT NULL,
      embedding double precision[] NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (namespace, source, chunk_index)
    );

    CREATE INDEX IF NOT EXISTS app_rag_chunks_namespace_idx ON app_rag_chunks(namespace);
    CREATE INDEX IF NOT EXISTS app_rag_chunks_source_idx ON app_rag_chunks(source);
  `)
  pgVectorAvailable = await setupPgVector(db)
  initialized = true
}

export async function indexKnowledgeDirectory(directory = defaultKnowledgeDirectory()) {
  await initRagStore()
  const files = await listMarkdownFiles(directory)
  let chunksIndexed = 0

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, 'utf8')
    const relativePath = path.relative(directory, filePath)
    const chunks = chunkMarkdown(raw)
    await deleteSourceChunks('health', relativePath)

    for (const [index, chunk] of chunks.entries()) {
      await upsertChunk({
        namespace: 'health',
        source: relativePath,
        title: chunk.title,
        chunkIndex: index,
        content: chunk.content,
      })
      chunksIndexed += 1
    }
  }

  return { files: files.length, chunks: chunksIndexed }
}

export async function searchKnowledge(query: string, limit = 5): Promise<RagChunk[]> {
  if (!initialized) await initRagStore()
  const normalizedQuery = query.trim()
  if (!normalizedQuery) return []

  const queryEmbedding = embedText(normalizedQuery)
  const rows = await queryCandidateRows(queryEmbedding)

  return rows
    .map((row) => {
      const content = `${row.title}\n${row.content}`
      const vectorScore =
        row.vector_score === undefined || row.vector_score === null
          ? cosineSimilarity(queryEmbedding, row.embedding)
          : Number(row.vector_score)
      return {
        id: row.id,
        namespace: row.namespace,
        source: row.source,
        title: row.title,
        content: row.content,
        score: vectorScore + lexicalScore(normalizedQuery, content) + domainIntentBoost(normalizedQuery, content),
      }
    })
    .filter((chunk) => chunk.score > 0.05)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}

export async function closeRagStore() {
  if (!pool) return
  await pool.end()
  pool = null
  initialized = false
  pgVectorAvailable = false
}

export function getRagStatus() {
  return {
    provider: 'postgresql',
    database: readDatabaseLabel(),
    pgVector: pgVectorAvailable,
  }
}

function getPool() {
  pool ??= new Pool(buildPoolConfig())
  return pool
}

function buildPoolConfig(): PoolConfig {
  if (process.env.RAG_DATABASE_URL) {
    return { connectionString: process.env.RAG_DATABASE_URL }
  }

  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL }
  }

  return {
    host: process.env.RAG_PGHOST ?? process.env.PGHOST ?? '127.0.0.1',
    port: Number(process.env.RAG_PGPORT ?? process.env.PGPORT ?? 5432),
    database: process.env.RAG_PGDATABASE ?? process.env.PGDATABASE ?? defaultDatabaseName,
    user: process.env.RAG_PGUSER ?? process.env.PGUSER ?? os.userInfo().username,
    password: process.env.RAG_PGPASSWORD ?? process.env.PGPASSWORD,
  }
}

function readDatabaseLabel() {
  const connectionString = process.env.RAG_DATABASE_URL ?? process.env.DATABASE_URL
  if (connectionString) return sanitizeConnectionString(connectionString)

  return `${process.env.RAG_PGHOST ?? process.env.PGHOST ?? '127.0.0.1'}:${
    process.env.RAG_PGPORT ?? process.env.PGPORT ?? 5432
  }/${process.env.RAG_PGDATABASE ?? process.env.PGDATABASE ?? defaultDatabaseName}`
}

function sanitizeConnectionString(connectionString: string) {
  try {
    const url = new URL(connectionString)
    if (url.password) url.password = '***'
    return url.toString()
  } catch {
    return connectionString.replace(/:\/\/([^:@]+):([^@]+)@/, '://$1:***@')
  }
}

function defaultKnowledgeDirectory() {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  return path.join(__dirname, '..', 'rag', 'knowledge')
}

async function listMarkdownFiles(directory: string) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(entryPath)))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath)
    }
  }

  return files.sort()
}

function chunkMarkdown(raw: string) {
  const cleanRaw = sanitizePostgresText(raw)
  const title = cleanRaw.match(/^#\s+(.+)$/m)?.[1]?.trim() || '健康知识'
  const paragraphs = cleanRaw
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  const chunks: Array<{ title: string; content: string }> = []
  let current = ''

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph
    if (next.length > 900 && current) {
      chunks.push({ title, content: current })
      current = paragraph
    } else {
      current = next
    }
  }

  if (current) chunks.push({ title, content: current })
  return chunks
}

async function deleteSourceChunks(namespace: string, source: string) {
  await getPool().query('DELETE FROM app_rag_chunks WHERE namespace = $1 AND source = $2', [namespace, source])
}

async function upsertChunk({
  namespace,
  source,
  title,
  chunkIndex,
  content,
}: {
  namespace: string
  source: string
  title: string
  chunkIndex: number
  content: string
}) {
  const safeTitle = sanitizePostgresText(title)
  const safeContent = sanitizePostgresText(content)
  const embedding = embedText(`${safeTitle}\n${safeContent}`)
  if (pgVectorAvailable) {
    await getPool().query(
      `
        INSERT INTO app_rag_chunks (id, namespace, source, title, chunk_index, content, embedding, embedding_vector, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector, now())
        ON CONFLICT (namespace, source, chunk_index)
        DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          embedding_vector = EXCLUDED.embedding_vector,
          updated_at = now()
      `,
      [crypto.randomUUID(), namespace, source, safeTitle, chunkIndex, safeContent, embedding, toPgVector(embedding)],
    )
    return
  }

  await getPool().query(
    `
      INSERT INTO app_rag_chunks (id, namespace, source, title, chunk_index, content, embedding, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, now())
      ON CONFLICT (namespace, source, chunk_index)
      DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content, embedding = EXCLUDED.embedding, updated_at = now()
    `,
    [crypto.randomUUID(), namespace, source, safeTitle, chunkIndex, safeContent, embedding],
  )
}

function sanitizePostgresText(value: string) {
  return value.replace(/\u0000/g, '')
}

async function setupPgVector(db: Pool) {
  try {
    await db.query('CREATE EXTENSION IF NOT EXISTS vector')
    await db.query(`
      ALTER TABLE app_rag_chunks ADD COLUMN IF NOT EXISTS embedding_vector vector(${embeddingDimensions});
      CREATE INDEX IF NOT EXISTS app_rag_chunks_embedding_vector_idx
        ON app_rag_chunks USING ivfflat (embedding_vector vector_cosine_ops)
        WITH (lists = 16);
    `)
    return true
  } catch (error) {
    console.warn(`[rag] pgvector unavailable; using array similarity fallback. ${readErrorMessage(error)}`)
    return false
  }
}

async function queryCandidateRows(queryEmbedding: number[]) {
  const db = getPool()
  if (pgVectorAvailable) {
    try {
      const vectorResult = await db.query<RagChunkRow>(
        `
          SELECT id, namespace, source, title, content, embedding, 1 - (embedding_vector <=> $2::vector) AS vector_score
          FROM app_rag_chunks
          WHERE namespace = $1 AND embedding_vector IS NOT NULL
          ORDER BY embedding_vector <=> $2::vector
          LIMIT 240
        `,
        ['health', toPgVector(queryEmbedding)],
      )
      if (vectorResult.rows.length) return vectorResult.rows
    } catch (error) {
      pgVectorAvailable = false
      console.warn(`[rag] pgvector search failed; using array similarity fallback. ${readErrorMessage(error)}`)
    }
  }

  const result = await db.query<RagChunkRow>(
    `
      SELECT id, namespace, source, title, content, embedding
      FROM app_rag_chunks
      WHERE namespace = $1
      ORDER BY updated_at DESC
      LIMIT 240
    `,
    ['health'],
  )
  return result.rows
}

function embedText(text: string) {
  const vector = Array.from({ length: embeddingDimensions }, () => 0)
  const tokens = tokenize(text)

  for (const token of tokens) {
    const hash = hashToken(token)
    const index = Math.abs(hash) % embeddingDimensions
    vector[index] += hash % 2 === 0 ? 1 : -1
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map((value) => value / magnitude)
}

function tokenize(text: string) {
  const normalized = text.toLowerCase()
  const words = normalized.match(/[a-z0-9]+|[\u4e00-\u9fff]/gu) ?? []
  const bigrams: string[] = []

  for (let index = 0; index < words.length - 1; index += 1) {
    bigrams.push(`${words[index]}${words[index + 1]}`)
  }

  return [...words, ...bigrams]
}

function hashToken(token: string) {
  let hash = 0
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash << 5) - hash + token.charCodeAt(index)
    hash |= 0
  }
  return hash
}

function cosineSimilarity(left: number[], right: number[]) {
  if (!left.length || !right.length) return 0
  const length = Math.min(left.length, right.length)
  let dot = 0

  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index]
  }

  return dot
}

function lexicalScore(query: string, content: string) {
  const queryTokens = new Set(tokenize(query))
  const contentTokens = new Set(tokenize(content))
  if (!queryTokens.size || !contentTokens.size) return 0
  let matches = 0

  for (const token of queryTokens) {
    if (contentTokens.has(token)) matches += 1
  }

  return matches / Math.max(queryTokens.size, 1)
}

function domainIntentBoost(query: string, content: string) {
  const normalizedContent = content.toLowerCase()
  let boost = 0

  if (
    /痛|疼|伤|麻|肿|胸闷|眩晕|呼吸|不舒服|膝|腰|肩|踝/.test(query) &&
    /恢复与安全边界|疼痛|停止|专业评估|低冲击|膝盖疼|腰疼|肩痛|伤后|肿胀/.test(normalizedContent)
  ) {
    boost += 0.45
  }

  if (/热量|蛋白|碳水|脂肪|饮食|餐|饭|减脂/.test(query) && /营养|热量|蛋白|碳水|脂肪/.test(normalizedContent)) {
    boost += 0.18
  }

  if (/训练|运动|跑|力量|深蹲|俯卧撑|硬拉|有氧|增肌|练/.test(query) && /训练|负荷|强度|动作|组|恢复/.test(normalizedContent)) {
    boost += 0.18
  }

  return boost
}

function toPgVector(vector: number[]) {
  return `[${vector.map((value) => (Number.isFinite(value) ? value.toFixed(8) : '0')).join(',')}]`
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
