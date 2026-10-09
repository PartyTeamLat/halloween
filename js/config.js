// Public invitation. Edit these values, save, and refresh.
// The price people see is priceAmount and priceSymbol.
// Keep the Google Sheet priceLabel the same once the sheet is connected.

window.PARTY = {
  name: "Halloween",
  hostLine: "A private gathering",
  dateLabel: "Friday, October 30",
  timeLabel: "9 p.m. to 2 a.m.",
  placeLabel: "ASOBIBA Tsukuba, second floor",
  placeAddress: "724 Saiki, Tsukuba",
  placeUrl: "https://maps.app.goo.gl/qSQiDCiEJaP639ev6",

  lede:
    "A Halloween night on the second floor of ASOBIBA Tsukuba. Snacks and a soft drink bar are included, there is a costume competition, and every person needs their own invitation.",

  priceAmount: 2000,
  priceSymbol: "¥",
  priceNote: "per person, once your place is confirmed",
  paymentPublic: "How to pay arrives in the invitation.",

  capacity: 0,
  capacityNote: "Each person needs their own invitation. A yes for you does not cover anyone else.",

  offerings: [
    {
      title: "A soft drink bar",
      text: "Included for everyone. The bar does not serve alcohol. You may bring your own drinks.",
    },
    {
      title: "Snacks",
      text: "We are providing snacks, not a meal. You are welcome to bring food.",
    },
    {
      title: "A costume competition",
      text: "Costumes are encouraged, not required. Dress up if you want to enter.",
    },
    {
      title: "Your own invitation",
      text: "Every person asks for their own place. We can refuse entry for unruly or disruptive behavior.",
    },
  ],

  rules: [
    "Requesting a place is not an invitation. Wait until we accept you.",
    "Each person needs their own invitation. Do not arrive with someone who has not been accepted.",
    "The night is Friday, October 30, from 9 p.m. to 2 a.m., on the second floor of ASOBIBA Tsukuba.",
    "The drink bar is included and non-alcoholic. You may bring your own drinks.",
    "We are providing snacks, not a meal. You may bring food.",
    "Costumes are encouraged, not required. There is a costume competition.",
    "Pay the contribution after you are accepted. The amount is on this page.",
    "We can refuse entry, or ask you to leave, for unruly or disruptive behavior.",
  ],

  // Paste the Apps Script web app URL after you deploy it.
  // It looks like https://script.google.com/macros/s/XXXX/exec
  // Leave this empty to try the form on this browser only.
  scriptUrl: "https://script.google.com/macros/s/AKfycbzKUYwetxZFsNGxm6Lzt1BTypB7VE8kmjNNEqWicBUa-c-72wQItwx3zsCj2Svh-5Eh/exec",
};
