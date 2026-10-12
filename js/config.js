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

  lede: "Come to dance and have fun.",

  priceAmount: 2000,
  priceSymbol: "¥",
  priceNote: "per person, if we confirm your place",
  paymentPublic: "We'll tell you how to pay in the invitation.",

  capacity: 0,
  capacityNote: "",

  offerings: [
    {
      title: "A costume competition",
      text: "Dress up if you want to enter. A costume is welcome, not required.",
    },
    {
      title: "Drinks and snacks",
      text: "Soft drinks included. Bring your own if you want alcohol. Snacks, not a meal.",
    },
    {
      title: "Your own invitation",
      text: "One person, one request. If you get an invitation, it is just for you.",
    },
  ],

  rules: [
    "Asking is the first step. We'll email you if we can save you a place.",
    "Each person asks for their own invitation.",
    "Look after the people around you.",
    "Perreo until 2 a.m. The playlist is not up for debate.",
    "Help us leave the place tidy.",
    "The contribution is on this page. Pay it after we invite you.",
    "If someone is unruly or spoiling the night, we can turn them away or ask them to leave.",
  ],

  // Paste the Apps Script web app URL after you deploy it.
  // It looks like https://script.google.com/macros/s/XXXX/exec
  // Leave this empty to try the form on this browser only.
  scriptUrl: "https://script.google.com/macros/s/AKfycbzKUYwetxZFsNGxm6Lzt1BTypB7VE8kmjNNEqWicBUa-c-72wQItwx3zsCj2Svh-5Eh/exec",
};
