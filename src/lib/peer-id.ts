import { truncateMiddle } from "@/lib/utils";

export function truncatePeerId(peerId: string): string {
  return truncateMiddle(peerId, 8, 4);
}
