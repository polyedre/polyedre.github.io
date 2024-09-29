# Personal blog

This is my personal blog.

## Serve

```sh
podman run -p 8080:8080 -v ${PWD}:/src docker.io/hugomods/hugo hugo server -p 8080 --bind 0.0.0.0
```
