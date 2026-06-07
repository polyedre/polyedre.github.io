# Personal blog

My personal blog, served at [polyed.re](https://polyed.re).

It's a hand-written static site — plain HTML, CSS, and a little JS, no build
step. All content lives under [`poc/`](poc/), with posts as pre-rendered
`poc/posts/<slug>/index.html`.

## Serve locally

Any static file server works:

```sh
python3 -m http.server -d poc 8080
```

Then open <http://localhost:8080>.

## Deploy

Pushing to `main` triggers `.github/workflows/gh-pages.yml`, which publishes
the contents of `poc/` to the `gh-pages` branch. GitHub Pages serves that
branch at the custom domain in [`poc/CNAME`](poc/CNAME).
