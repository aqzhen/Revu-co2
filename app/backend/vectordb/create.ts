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

export async function createProductsTable(deleteExistingReviews: boolean) {
  try {
    if (deleteExistingReviews) {
      console.log("Dropping products table");

      await singleStoreConnection.execute("DROP TABLE IF EXISTS Products");
    }
    await singleStoreConnection.execute(`
                CREATE TABLE Products (
                    productId BIGINT PRIMARY KEY,
                    title TEXT,
                    description TEXT,
                    embedding VECTOR(768)
                )
            `);
    console.log("Products table created successfully.");
  } catch (err) {
    console.log("Products table already exists");
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

export async function createProductEmbeddingsTable(deleteExisting: boolean) {
  try {
    if (deleteExisting) {
      console.log("Dropping ProductEmbeddings table");

      await singleStoreConnection.execute(
        "DROP TABLE IF EXISTS ProductEmbeddings"
      );
    }
    await singleStoreConnection.execute(`
                CREATE TABLE ProductEmbeddings (
                    productId BIGINT,
                    chunkNumber BIGINT,
                    body TEXT,
                    chunkEmbedding VECTOR(768),
                    startIndex BIGINT,
                    endIndex BIGINT,
                    PRIMARY KEY (productId, chunkNumber)
                )
            `);
    console.log("ProductEmbeddings table created successfully.");
  } catch (err) {
    console.log("ProductEmbeddings table already exists");
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

export async function createUsersTable(deleteExisting: boolean) {
  try {
    if (deleteExisting) {
      console.log("Dropping users table");

      await singleStoreConnection.execute("DROP TABLE IF EXISTS Users");
    }
    await singleStoreConnection.execute(`
                CREATE TABLE Users (
                    userId BIGINT,
                    firstName TEXT,
                    lastName TEXT,
                    email TEXT,
                    accountCreated TIMESTAMP,
                    PRIMARY KEY (userId, email)
                )
            `);
    console.log("Users table created successfully.");
  } catch (err) {
    console.log(err);
    console.log("Users table already exists");
  }
}

export async function createSegmentsTable(deleteExisting: boolean) {
  try {
    if (deleteExisting) {
      console.log("Dropping segments table");

      await singleStoreConnection.execute("DROP TABLE IF EXISTS Segments");
    }
    await singleStoreConnection.execute(`
                CREATE TABLE Segments (
                    segmentId BIGINT AUTO_INCREMENT PRIMARY KEY,
                    purchaseStatus TEXT,
                    productId BIGINT,
                    semanticSegmentReview TEXT,
                    semanticSegmentQuery TEXT,
                    semanticSegmentCxQuery TEXT,
                    overReviews BOOL,
                    overQueries BOOL,
                    overCxQueries BOOL,
                    userIds TEXT -- JSON array of userIds
                )
            `);
    console.log("Segments table created successfully.");
  } catch (err) {
    console.log("Segments table already exists");
  }
}

export async function createAllTables(deleteExisting: boolean) {
  createCustomerSupportCorpusTable(deleteExisting);
  createCustomerSupportQueriesTable(deleteExisting);
  createEmbeddingsTable(deleteExisting);
  createPurchasesTable(deleteExisting);
  createQueriesTable(deleteExisting);
  createReviewTable(deleteExisting);
  createProductsTable(deleteExisting);
  createUsersTable(deleteExisting);
  createSegmentsTable(deleteExisting);
  createProductEmbeddingsTable(deleteExisting);
}
