# FormCraft

Pick a muscle and your level, get exercises with sets, reps, rest, steps and sources. Calisthenics, bodyweight, yoga and gym equipment, all in one search. Browse without an account; log in to save cards.

![theme](https://img.shields.io/badge/theme-black%20%7C%20red%20%7C%20yellow%20%7C%20blue-111) ![node](https://img.shields.io/badge/node-%E2%89%A522.13-3c873a) ![license](https://img.shields.io/badge/license-MIT-blue)

## Features

| Feature | Details |
|---|---|
| Body-part search | Specific ("lats") or broad ("lower body", "thighs") input expands to the right muscles. |
| Levels | Novice, Intermediate, Pro. Sets and reps rise with level, rest shortens. |
| Goal | Any, Strength, Endurance or Cardio. |
| Categories | Calisthenics, Bodyweight, Yoga, Gym equipment. None selected shows all. |
| Cards | Text-only cards: category, level meter, target muscles, sets, reps, rest, steps, source link. Same-name entries are merged and near-identical variants collapsed. |
| Accounts | Register/login, saved cards. bcrypt, httpOnly cookie, rate limiting, CSP. |
| 3D body map | Optional three.js model. Click a muscle to search it. |

## Quick start (Windows, macOS, Linux)

Requires Node.js 22.13 or newer and an internet connection for the first install.

    npm install
    npm start

Open http://localhost:3000. `npm install` builds the 3D bundle; the exercise data ships with the repo. Use `npm run dev` to auto-restart while editing. Cards are text-only by design.

## Configuration

Copy `.env.example` to `.env`. In production set `NODE_ENV=production` and a long random `JWT_SECRET`, and serve over HTTPS.

## Deploy (Vercel + Neon)

1. Create a free Postgres database at neon.tech and copy its connection string.
2. Import the GitHub repo in Vercel.
3. Under Settings, Environment Variables, add `JWT_SECRET` (a long random string) and `DATABASE_URL` (the Neon string) for Production.
4. Deploy. Tables are created automatically on the first request.

If `JWT_SECRET` is missing the site still loads and search works; login and saved cards return a clear "not configured" message instead of crashing. Without `DATABASE_URL`, accounts use temporary storage and disappear on cold starts, so always set it in production.

`vercel.json` sends API requests to `api/index.js` and bundles `public` and `data` into the function. The exercise data (`data/exercises.json`) is committed as a fixed snapshot, so every deploy shows identical data.

## Refreshing the data

`npm run build:data` rebuilds `data/exercises.json` from the sources below and `data/*.txt`. Run it only when you want to update the dataset, then commit the result.

## Project layout

    server.js            API, auth, search
    db.js                PostgreSQL (production) or SQLite (local) adapter
    scripts/build-data.js  builds data/exercises.json from the sources below
    data/program.txt     hand-curated list (legs, back, chest) with level tags and notes
    data/catalog.txt     bodyweight list (names, muscles, levels, equipment)
    data/extras.txt      moves from the plan and chart not in the list above
    data/plan.txt        reps/sets from the source plan table
    src/viz.js           three.js body model (bundled to public/viz.js)
    public/              frontend (index.html, app.js)

## Data sources and credits

| Source | Used for | License |
|---|---|---|
| [free-exercise-db](https://github.com/yuhonas/free-exercise-db) | Steps and gym/bodyweight exercises | Unlicense (public domain) |
| [The Fitness Phantom](https://thefitnessphantom.com/list-of-bodyweight-exercises-with-pdf) | Bodyweight list (names, levels as published, equipment) and the calisthenics plan's reps/sets, shown as "Source plan" | Website content, credited; facts only, no article text |
| Exercise chart (supplied by the project owner) | 6 extra bodyweight moves; their levels are estimates | n/a |
| [yoga-api](https://github.com/LunaticPrakash/yoga-api) | Yoga poses, steps, benefits, cautions | No license file found. Included in the committed data snapshot. Get the author's permission before deploying publicly, or remove the yoga block in `scripts/build-data.js` and rebuild. |

Sets, reps and rest are level-based templates informed by ACSM position stands (Med Sci Sports Exerc 2009, 2011) and NSCA guidance. Volume rises with level by design; this is not a maximal-strength program. Verify the figures against those sources before relying on them. General information, not medical advice.

## Known limitations

- Acrobatics and gymnastics have no verified open dataset, so they are not included.
- Yoga poses have no difficulty ratings in the source.
- Ankles and shins have no muscle tag in the dataset; they are matched by exercise name (ankle, tibialis, shin) plus calf and heel raises and yoga poses tagged ankle.
- The dataset has no ankle or tibialis tags; those searches map to calves.
- Local development uses Node's built-in `node:sqlite` (experimental in Node 22); production uses PostgreSQL via `DATABASE_URL`.

## License

MIT for the code. Data sources keep their own licenses (see above).
