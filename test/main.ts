//

const arrowFunction = (): void => {
  console.log("Hello World");
};

function functionDec(): void {
  console.log("Hello World");
}

export class ClassDec {
  constructor() {}

  public method(): void {
    arrowFunction();

    functionDec();
  }
}

// arrowFunction();



arrowFunction(); // arrowFunction();
// arrowFunction();
// arrowFunction();

functionDec();
