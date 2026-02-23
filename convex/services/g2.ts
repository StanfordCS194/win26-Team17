/**
 * G2 Client (Stub)
 *
 * Placeholder for future G2 integration. Returns empty results.
 */

export interface IG2Client {
  searchReviews(productName: string): Promise<never[]>;
}

export class G2Client implements IG2Client {
  async searchReviews(_productName: string): Promise<never[]> {
    console.log("G2 integration not yet implemented");
    return [];
  }
}

export function createG2Client(): IG2Client {
  return new G2Client();
}
