// comment line
import { Three } from "./three";

export namespace NS {
  export class Two {
    callThreeTwice(): void {
      new Three().tada();
      new Three().tada();
    }
  }
}
