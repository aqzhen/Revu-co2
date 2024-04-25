import { Query } from "../../globals";

interface Point {
  queryId: number;
  query: string;
  embedding: number[]; // 768-dimensional vector,
  clusterLabel?: number;
}

class KMeansClustering {
  private points: Point[];
  private k: number;
  private centroids: number[][];

  constructor(points: Point[], k: number) {
    this.points = points;
    this.k = k;
    this.centroids = [];
  }

  private initializeCentroids(): void {
    // Randomly select k points as initial centroids
    const shuffledPoints = this.points.slice();
    for (let i = shuffledPoints.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledPoints[i], shuffledPoints[j]] = [
        shuffledPoints[j],
        shuffledPoints[i],
      ];
    }
    this.centroids = shuffledPoints
      .slice(0, this.k)
      .map((point) => point.embedding);
  }

  private assignPointsToCentroids(): void {
    for (const point of this.points) {
      let minDistance = Infinity;
      let closestCentroidIndex = -1;
      for (let i = 0; i < this.centroids.length; i++) {
        const distance = this.calculateDistance(
          point.embedding,
          this.centroids[i],
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestCentroidIndex = i;
        }
      }
      point.clusterLabel = closestCentroidIndex;
    }
  }

  private updateCentroids(): void {
    const clusterSums = new Array(this.k)
      .fill(0)
      .map(() => new Array(this.points[0].embedding.length).fill(0));
    const clusterCounts = new Array(this.k).fill(0);

    for (const point of this.points) {
      const clusterIndex = point.clusterLabel as number;
      clusterCounts[clusterIndex]++;
      for (let i = 0; i < point.embedding.length; i++) {
        clusterSums[clusterIndex][i] += point.embedding[i];
      }
    }

    for (let i = 0; i < this.k; i++) {
      for (let j = 0; j < this.centroids[i].length; j++) {
        this.centroids[i][j] = clusterSums[i][j] / clusterCounts[i];
      }
    }
  }

  private calculateDistance(
    embedding1: number[],
    embedding2: number[],
  ): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += Math.pow(embedding1[i], 2);
      norm2 += Math.pow(embedding2[i], 2);
    }
    const cosineSimilarity = dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    const cosineDistance = 1 - cosineSimilarity;
    return cosineDistance;
  }

  public fit(): number[] {
    this.initializeCentroids();

    let prevCentroids: number[][] = [];
    while (!this.areCentroidsEqual(prevCentroids, this.centroids)) {
      prevCentroids = this.centroids.slice();

      this.assignPointsToCentroids();
      this.updateCentroids();
    }

    const clusterLabels = this.points.map(
      (point) => point.clusterLabel,
    ) as number[];
    return clusterLabels;
  }

  private areCentroidsEqual(
    centroids1: number[][],
    centroids2: number[][],
  ): boolean {
    if (centroids1.length !== centroids2.length) {
      return false;
    }
    for (let i = 0; i < centroids1.length; i++) {
      for (let j = 0; j < centroids1[i].length; j++) {
        if (centroids1[i][j] !== centroids2[i][j]) {
          return false;
        }
      }
    }
    return true;
  }
}

export function getQueryClusters(queries: Query[], k: number): string {
  const points: Point[] = queries.map((query: Query) => {
    return {
      queryId: query.queryId,
      query: query.query,
      embedding: JSON.parse(query.semanticEmbedding as string) as number[],
    };
  });
  const kMeans = new KMeansClustering(points, k);
  const clusterLabels = kMeans.fit();
  // for (let i = 0; i < clusterLabels.length; i++) {
  //   console.log("Query:", points[i].query);
  //   console.log("Cluster label:", clusterLabels[i]);
  // }

  function outputClusterResults(
    clusterLabels: number[],
    points: Point[],
  ): string {
    const clusters: { [key: number]: number[] } = {};
    for (let i = 0; i < clusterLabels.length; i++) {
      const clusterLabel = clusterLabels[i];
      if (!(clusterLabel in clusters)) {
        clusters[clusterLabel] = [];
      }
      clusters[clusterLabel].push(points[i].queryId);
    }

    let resultString = "";
    for (const clusterLabel in clusters) {
      const queryIds = clusters[clusterLabel].join(", ");
      resultString += `Category ${clusterLabel}: [${queryIds}]\n`;
    }
    return resultString;
  }

  return outputClusterResults(clusterLabels, points);
}
