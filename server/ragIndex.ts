import { closeRagStore, indexKnowledgeDirectory } from './rag.js'

try {
  const result = await indexKnowledgeDirectory()
  console.log(`Indexed ${result.chunks} RAG chunks from ${result.files} files.`)
} finally {
  await closeRagStore()
}
