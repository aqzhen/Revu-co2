export async function deleteSegment(segmentId: number) {
  try {
    await singleStoreConnection.execute(
      `
            DELETE FROM Segments WHERE segmentId = ${segmentId}
            `
    );
  } catch (error) {
    console.error("Error deleting segment: ", error);
  }
}
