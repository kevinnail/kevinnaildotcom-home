const wholeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const oneDecimal = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function formatMiles(miles) {
  return `${oneDecimal.format(miles)} mi`;
}

export function formatFeet(feet) {
  return `${wholeNumber.format(feet)} ft`;
}
