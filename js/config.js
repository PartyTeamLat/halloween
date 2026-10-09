// Public invitation. Edit these values, save, and refresh.
// The price people see is priceAmount and priceSymbol.
// Keep the Google Sheet priceLabel the same once the sheet is connected.

window.PARTY = {
  name: "Halloween",
  hostLine: "A Latin party",
  dateLabel: "Friday, October 30",
  timeLabel: "9 p.m. to 2 a.m.",
  placeLabel: "ASOBIBA Tsukuba, second floor",
  placeAddress: "724 Saiki, Tsukuba",
  placeUrl: "https://maps.app.goo.gl/qSQiDCiEJaP639ev6",

  lede: "Come to dance.",

  priceAmount: 2000,
  priceSymbol: "¥",
  priceNote: "per person, once your place is confirmed",
  paymentPublic: "How to pay arrives in the invitation.",

  capacity: 0,
  capacityNote: "",

  offerings: [
    {
      title: "A costume competition",
      text: "Encouraged, not required.",
    },
    {
      title: "Drinks and snacks",
      text: "Soft drinks included. No alcohol, though you may bring your own. Snacks, not a meal. You may bring food.",
    },
    {
      title: "Your own invitation",
      text: "One person, one request. We can refuse entry.",
    },
  ],

  rules: [
    "A request is not an invitation. Wait until we accept you.",
    "Each person needs their own invitation.",
    "Respect other people.",
    "El perreo is protected until 2 a.m. The playlist will not be taking objections.",
    "Keep the place clean and organized.",
    "Pay the contribution after you are accepted. The amount is on this page.",
    "We can refuse entry, or ask you to leave, for unruly or disruptive behavior.",
  ],

  // Paste the Apps Script web app URL after you deploy it.
  // It looks like https://script.google.com/macros/s/XXXX/exec
  // Leave this empty to try the form on this browser only.
  scriptUrl: "https://script.google.com/macros/s/AKfycbzKUYwetxZFsNGxm6Lzt1BTypB7VE8kmjNNEqWicBUa-c-72wQItwx3zsCj2Svh-5Eh/exec",
};
