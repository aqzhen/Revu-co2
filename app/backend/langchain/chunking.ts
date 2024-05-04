import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export interface Chunk {
  chunkBody: string;
  startIndex: number;
  endIndex: number;
  reviewId: number;
}

export async function chunk_string(
  chunkString: string,
  reviewId: number,
  chunkSize: number = 256,
  chunkOverlap: number = 20
) {
  const n = chunkString.length;
  let start = 0;
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: chunkSize,
    chunkOverlap: chunkOverlap,
  });
  const chunks = await splitter.createDocuments([chunkString]);
  const res = chunks.map((item) => {
    let body = item.pageContent;
    let start = chunkString.indexOf(body);
    let end = start + body.length - 1;
    let chunk: Chunk = {
      chunkBody: item.pageContent,
      startIndex: start,
      endIndex: Math.min(end, n - 1),
      reviewId: reviewId,
    };
    return chunk;
  });

  // res.forEach(element => {
  //   console.log(element.chunkBody.length, element.startIndex, element.endIndex);
  // });
  // console.log(res);
  return res;
}
