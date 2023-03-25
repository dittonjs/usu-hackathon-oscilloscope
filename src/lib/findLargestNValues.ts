export const findNLargestValues = (n: number, values: Float32Array) => {
  const result: number[] = [];
  for (let i = 0; i < n; i ++){
    let largest = -999;
    let largestIndex = 0;
    for(let j = 0; j < values.length; j++) {
      if (values[j] > largest && !result.includes(j) && values[j] !== 0) {
        largestIndex = j;
        largest = values[j]
      }
    }
    result.push(largestIndex);
  }
  return result;
}