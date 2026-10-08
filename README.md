# Next-Gen MFD & IFA Practice Survey — website

An interactive web version of `Next-Gen MFD & IFA Practice Survey.docx`, with a results dashboard. No dependencies: it needs only Node.js 18 or later.

## Run it

```bash
node server.mjs
```

- Survey: http://localhost:3000
- Dashboard: http://localhost:3000/admin
- Responses are saved to `data/responses.json`

To password-protect the dashboard data:

```bash
ADMIN_KEY=choose-a-secret node server.mjs
# then open http://localhost:3000/admin?key=choose-a-secret
```

`PORT=8000 node server.mjs` changes the port.

## How the document's colours are used

| Colour in doc | Priority | Behaviour in the survey | Questions |
|---|---|---|---|
| Red | High | **Required**: the survey can't continue without an answer | Q5, Q10, Q12, Q13, Q14, Q16, Q17 |
| Green | Second | **Recommended**: one friendly reminder if skipped, then can be skipped | Q7, Q8, Q9, Q11, Q15 |
| Black | Third | **Optional**: can be skipped freely | Q1, Q2, Q3, Q4, Q6 |

Q17 (the family-practice question) is shown only to people who answer "Second-generation" in Q2. Everyone else is saved as "Not applicable".

## Interactive features

**Survey**
- One question per screen, with slide animations and a clickable progress bar
- Single-choice questions move to the next question automatically after a pick
- "Select up to N" limits with a live counter
- "Other" opens a text box
- Q12 rating grid: tap 1–5, and the page jumps to the next unrated row. Keyboard: `1`–`5` to rate, `↑`/`↓` to move between rows
- Q13 offers the respondent's own top-rated Q12 challenges as one-tap answers
- Keyboard shortcuts: `1`–`9` picks an option, `Enter` goes to the next question
- Answers are auto-saved in the browser, so closing the tab and coming back offers "Resume where I left off"
- Review screen before submitting, with an Edit button on every answer
- Confetti and a WhatsApp share button on the thank-you screen
- Light and dark mode; works on phones

**Dashboard**
- Key numbers at the top
- Q12 challenge heatmap; click a column to sort it
- A chart for every question, grouped by priority
- **Click any bar or heatmap row to filter every chart** (cross-filtering)
- Q13 free-text answers, with search
- A table of individual responses; click one to see the full response
- CSV export (opens in Excel) and JSON export of the filtered data
- "Show sample data" shows 120 made-up responses for previewing the dashboard before real data arrives

## Editing questions

All survey content is in [`js/questions.js`](js/questions.js). Change the text, options or `priority` (1, 2 or 3) there; no other file needs to change.

## Files

```
index.html       survey page
admin.html       dashboard page
css/styles.css   shared styles (light + dark)
js/questions.js  survey content: edit this to change questions
js/survey.js     survey flow
js/admin.js      dashboard
js/store.js      saving: server first, browser as fallback
js/common.js     shared helpers
server.mjs       static server + /api/responses
data/            created on first response (not served publicly)
```

## Hosting (GitHub Pages + Google Sheets)

Live site: https://aadarshmishra404.github.io/mfd-ifa-survey/
Dashboard: https://aadarshmishra404.github.io/mfd-ifa-survey/admin.html?key=YOUR_ADMIN_KEY

GitHub Pages serves only static files, so responses are stored in a Google Sheet:

1. Create a Google Sheet, then open **Extensions → Apps Script**. Delete the starter code and paste in all of [`google-apps-script.js`](google-apps-script.js). Save.
2. Open **Project Settings** (gear icon) → **Script properties** → **Add property**: `ADMIN_KEY` = a secret of your choice.
3. Go to **Deploy → New deployment**. Choose the type **Web app**, set *Execute as* to **Me** and *Who has access* to **Anyone**, then **Deploy** and authorise it.
4. Copy the **Web app URL** (it ends in `/exec`) into `sheetsUrl` in [`js/config.js`](js/config.js). Then commit and push; Pages redeploys within about a minute.

Each response becomes one row in the **Responses** tab, with one readable column per answer, plus a `raw_json` column that the dashboard uses.

If you change `google-apps-script.js` later, use **Deploy → Manage deployments → Edit → New version**. This keeps the same URL.

With `sheetsUrl` left empty, the site falls back to `node server.mjs` (local or any Node host). If the backend can't be reached, a response is kept in the respondent's browser and sent the next time they open the page.
