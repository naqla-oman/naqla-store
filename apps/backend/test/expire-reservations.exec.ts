/** منخفضة: انتهاء الحجوزات — npx medusa exec ./test/expire-reservations.exec.ts */
import { expireReservations } from "../src/jobs/expire-reservations"
export default async function run({ container }: any) {
  console.log("RESULT", JSON.stringify(await expireReservations(container)))
}
