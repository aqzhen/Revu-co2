// Create Tables
export async function createReviewTable(deleteExisting: boolean) {
  try {
    if (deleteExisting) {
      await singleStoreConnection.execute("DROP TABLE IF EXISTS Review");
    }
    await singleStoreConnection.execute(`
            CREATE TABLE Review (
                reviewId BIGINT PRIMARY KEY,
                productId BIGINT,
                reviewerName VARCHAR(255),
                reviewerExternalId BIGINT,
                createdAt TIMESTAMP,
                updatedAt TIMESTAMP,
                verified VARCHAR(255),
                rating INT,
                title VARCHAR(255),
                body TEXT
            )
        `);
    console.log("Reviews table created successfully.");
  } catch (err) {
    console.log("Reviews table already exists");
  }
}

export async function createQueriesTable(deleteExisting: boolean) {
  try {
    if (deleteExisting) {
      await singleStoreConnection.execute("DROP TABLE IF EXISTS Queries");
    }
    await singleStoreConnection.execute(`
                CREATE TABLE Queries (
                    queryId BIGINT AUTO_INCREMENT PRIMARY KEY,
                    productId BIGINT,
                    userId BIGINT,
                    query TEXT,
                    queryEmbedding VECTOR(768), -- OpenAI embeddings are 768-dimensional, embedding for entire query
                    semanticEmbedding VECTOR(768), -- OpenAI embeddings are 768-dimensional, semantic embedding is embedding for relevant context of query
                    answer TEXT
                )
            `);
    console.log("Queries table created successfully.");
  } catch (err) {
    console.log("Queries table already exists");
  }
}

export async function createSellerQueriesTable(deleteExisting: boolean) {
  try {
    if (deleteExisting) {
      await singleStoreConnection.execute(
        "DROP TABLE IF EXISTS Seller_Queries"
      );
    }
    await singleStoreConnection.execute(`
                CREATE TABLE Seller_Queries (
                  queryId BIGINT AUTO_INCREMENT PRIMARY KEY,
                  productId BIGINT,
                  userId BIGINT,
                  query TEXT,
                  queryEmbedding VECTOR(768), -- OpenAI embeddings are 768-dimensional, embedding for entire query
                  semanticEmbedding VECTOR(768), -- OpenAI embeddings are 768-dimensional, semantic embedding is embedding for relevant context of query
                  answer TEXT
              )
          `);
    console.log("Seller_Queries table created successfully.");
  } catch (err) {
    console.log("Seller_Queries table already exists");
  }
}

export async function createEmbeddingsTable(deleteExisting: boolean) {
  try {
    if (deleteExisting) {
      console.log("Dropping embedding table");

      await singleStoreConnection.execute("DROP TABLE IF EXISTS Embeddings");
    }
    await singleStoreConnection.execute(`
                CREATE TABLE Embeddings (
                    reviewId BIGINT,
                    chunkNumber BIGINT,
                    body TEXT,
                    chunkEmbedding VECTOR(768),
                    startIndex BIGINT,
                    endIndex BIGINT,
                    PRIMARY KEY (reviewId, chunkNumber)
                )
            `);
    console.log("Embeddings table created successfully.");
  } catch (err) {
    console.log("Embeddings table already exists");
  }
}

export async function createPurchasesTable(deleteExisting: boolean) {
  try {
    if (deleteExisting) {
      console.log("Dropping purchases table");

      await singleStoreConnection.execute("DROP TABLE IF EXISTS Purchases");
    }
    await singleStoreConnection.execute(`
                CREATE TABLE Purchases (
                    userId BIGINT,
                    productId BIGINT,
                    purchased BOOL,
                    quantity int,
                    PRIMARY KEY (userId, productId)
                )
            `);
    console.log("Purchases table created successfully.");
  } catch (err) {
    console.log("Purchases table already exists");
  }
}

export async function createCustomerSupportQueriesTable(
  deleteExistingReviews: boolean
) {
  try {
    if (deleteExistingReviews) {
      await singleStoreConnection.execute(
        "DROP TABLE IF EXISTS Customer_Support_Queries"
      );
    }
    await singleStoreConnection.execute(`
                CREATE TABLE Customer_Support_Queries (
                  queryId BIGINT AUTO_INCREMENT PRIMARY KEY,
                  productId BIGINT,
                  userId BIGINT,
                  query TEXT,
                  queryEmbedding VECTOR(768), -- OpenAI embeddings are 768-dimensional, embedding for entire query
                  semanticEmbedding VECTOR(768), -- OpenAI embeddings are 768-dimensional, semantic embedding is embedding for relevant context of query
                  answer TEXT
              )
          `);
    console.log("Customer_Support_Queries table created successfully.");
  } catch (err) {
    console.log("Customer_Support_Queries table already exists");
  }
}

export async function createCustomerSupportCorpusTable(
  deleteExisting: boolean
) {
  try {
    if (deleteExisting) {
      console.log("Dropping embedding table");

      await singleStoreConnection.execute(
        "DROP TABLE IF EXISTS Customer_Support_Corpus"
      );
    }
    await singleStoreConnection.execute(`
                CREATE TABLE Customer_Support_Corpus (
                    documentId BIGINT,
                    chunkNumber BIGINT,
                    body TEXT,
                    chunkEmbedding VECTOR(768),
                    startIndex BIGINT,
                    endIndex BIGINT,
                    PRIMARY KEY (documentId, chunkNumber)
                )
            `);
    console.log("Customer_Support_Corpus table created successfully.");
  } catch (err) {
    console.log("Customer_Support_Corpus table already exists");
  }
}

export async function createAllTables(deleteExisting: boolean) {
  createCustomerSupportCorpusTable(deleteExisting);
  createCustomerSupportQueriesTable(deleteExisting);
  createEmbeddingsTable(deleteExisting);
  createPurchasesTable(deleteExisting);
  createQueriesTable(deleteExisting);
  createReviewTable(deleteExisting);
  createSellerQueriesTable(deleteExisting);
}