# Halloween guest list

A one-page invitation people can open on GitHub Pages. They read the evening, the rules, and the contribution, then ask for their own place. You accept them from the host list, and they get an email with how to pay.

The night is Friday, October 30, from 9 p.m. to 2 a.m., on the second floor of ASOBIBA Tsukuba. Each person needs their own invitation.

## Edit the public page

Open `js/config.js`. Change the name, date, time, price, what the night includes, and the rules. Leave `scriptUrl` empty until the sheet is deployed.

The price people see is `priceAmount` and `priceSymbol`. The price in the invitation email is the `priceLabel` cell in the sheet. Keep those the same.

## Connect the guest list

1. Create a new Google Sheet.
2. Go to **Extensions → Apps Script**.
3. Replace the starter code with everything in `apps-script/Code.gs`. Add a second file named `qr` and paste `apps-script/qr.gs` into it. That file draws the door code in the invitation email.
4. Choose the function `setup`, run it, and allow the permissions.
5. Back in the sheet, open the **Settings** tab and replace:
   - `adminPassword` — a password you do not use anywhere else
   - `address` — the real street address
   - `priceLabel` — the same price as the website, written as `¥2,000 per person`
   - `paymentInstructions` — where the money should go
   - `replyTo` — your email, so guests can answer the invitation
   - `hostName`, `partyName`, `dateLabel`, and `timeLabel`
6. In Apps Script, choose **Deploy → New deployment → Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Copy the web app URL. It ends in `/exec`.
8. Paste it into `scriptUrl` in `js/config.js`.

Editing the Settings sheet takes effect immediately. If you change `Code.gs` later, deploy a new version under **Manage deployments**.

## Put it on GitHub

1. Create a public repository and push this folder to the `main` branch.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, branch `main`, folder `/ (root)`.
4. The site will be at `https://YOUR-NAME.github.io/REPOSITORY-NAME/`.

This party is at https://partyteamlat.github.io/halloween/. The host list is that address with `admin.html` at the end. It is not linked from the invitation.

## Accept someone

1. Open the host list and enter the Settings password.
2. On a request, choose **Accept and email**.
3. Google sends the invitation from the account that owns the sheet. It includes the address, the price, and a door-code picture.
4. When the contribution arrives, choose **Mark paid**.

People you accepted before door codes existed need **Resend email** so they receive a picture.

## At the door

Open the host list and choose **Scan at the door**, or go to `door.html` on the same site. Sign in with the host password, then open the camera and point it at the picture in their email. The page says inside, already inside, or not invited. A code only works once. **Clear arrival** on the host list lets that same picture scan again. **Mark inside** is there if the camera cannot be used.

If the email fails, the host list still gives you the invitation text to copy. **Decline** does not send an email. **Restore** puts someone back on the asking list.

Before the sheet is connected, the site is a preview: requests stay in that one browser, and the host password is `demo`.
