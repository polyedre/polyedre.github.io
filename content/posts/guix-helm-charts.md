---
title: "Packaging and Deploying Helm Charts with Guix"
date: 2024-04-01
draft: false
---

My daily job requires me to maintain multiple Helm Charts released to multiple Kubernetes Clusters.

I've encountered mutiple limitations with Helm.

The Go templating engine sometimes is not enough. The only functions available to Chart Helm
maintainers have been added explicitely. You cannot add custom ones easily.

The values.yaml file is great at reducing the interface between the Helm Chart maintainer and the
users, but when an option is missing, the only ways are to fork or contribute a pull request, and
this lead to complex values.yaml Chart like those of bitnami (1427 lines):
https://github.com/bitnami/charts/blob/main/bitnami/argo-workflows/values.yaml.

I recently watched a lot of talk from the Kubecon 2024 that happened at Paris, and I've been
following the two Linux distributions Nix and Guix for a while (I mostly hoped to be able to
generate minimalist Docker containers, but we are not there yet). As a result, my Youtube history
led to a talk by Vladimir "farcaller" Pouzanov named [NixCon2023 Nix and Kubernetes: Deployments Done Right](https://www.youtube.com/watch?v=SEA1Qm8K4gY).

He implemented a Nix Pkgs repository containing only Helm Charts. This allowed him to override Helm
Chart configuration and resources without forking the Helm Chart. And finally, he was able to
deploy all the Kubernetes YAML definitions to mutiple Kubernetes clusters using Argo-CD.

As a proud daily Emacs user, between Nix and Guix, my heart sways more towards Guix. I'm mostly
interested in the fact that Guix is a complete programming language, while Nix is a DSL.

That's why I've been working on a port of this talk to Guix!

See https://github.com/polyedre/guix-helm-charts.

After a lot of trial an error, I was finally able to create a Helm Chart package that contains the
raw Helm Chart:

```scheme
(define-public nginx-15.14.0
  (package
   (name "nginx")
   (version "15.14.0")
   (source (origin
            (method url-fetch)
            (uri "https://charts.bitnami.com/bitnami/nginx-15.14.0.tgz")
            (sha256 #f)))
   (build-system copy-build-system)
   (home-page "https://bitnami.com")
   (synopsis "NGINX Open Source is a web server that can be also used as a reverse proxy, load balancer, and HTTP cache. Recommended for high-demanding sites due to its ability to provide faster content.")
   (description "NGINX Open Source is a web server that can be also used as a reverse proxy, load balancer, and HTTP cache. Recommended for high-demanding sites due to its ability to provide faster content.")
   (license #f)))
```

With that, I could create a Helm Release from the Helm Chart by specifying a name to the release, a
Namespace and some custom values:

```scheme
; This function generates a YAML file tree containing the definitions of the
; resources that would be applied when deploying the chart `chart` under the
; release name `name`, to the Kubernetes Namespace `namespace`, with the values
; `values`. The value argument must be a json object.
(define (helm-release name chart namespace values)
    (with-imported-modules '((guix build utils))
      (computed-file name
         #~(begin
           (use-modules (guix build utils))
           (mkdir-p #$output)
           (system (format #f "~a template ~a ~a --output-dir ~a --release-name --values ~a"
                    (string-append #$helm "/bin/helm")
                    #$name
                    #$chart
                    #$output
                    #$(plain-file "values.json" (scm->json-string values))))))))
```

This function creates a Helm Release:

```scheme
(helm-release "my-custom-release-name" ilum-jupyter-6.1.0 "default"
                '((ingress . ((enabled . #t)
                              (host . "example.com")))
```

To deploy the Helm release to a Kubernetes cluster, I only have to use `kubectl apply`:

```sh
kubectl apply -f $(guix build -f example.scm)
```

Multiple Helm Charts can be released together with the use of Guix's `directory-union` method:

```sh
(directory-union "helm-releases"
  (list
    (helm-release "my-custom-release-name" ilum-jupyter-6.1.0 "default"
                  '((ingress . ((enabled . #t)
                                (host . "example.com")))
                    (tolerations . #(((operator . "Exists"))))))
    (helm-release "my-second" ilum-jupyter-6.0.0 "test" '())
    (helm-release "another" nginx-15.14.0 "kubernetes-tools" '())))
```

Using Guix has not been easy. I have some experience with emacs-lisp, so I was not afraid of the
parenthesis or the functional programming paradigm. I mostly struggled to understand my errors
because Guile does not always point to the failing line (probably because of the functional
programming paradigm).

After a lot of struggle, I discovered [The Perfect
Setup](https://guix.gnu.org/manual/en/html_node/The-Perfect-Setup.html) in Guix's documentation.
This is a page describing how to configure Emacs to develop with Guix. I was able to configure
Geiser in Emacs, but something must be wrong about by load-path because the Geiser REPL was not able
to import Guix modules.

Edit: Thanks to @Z572@mastodon.social for pointing out that when working on Guile for Guix in Emacs,
I can use command `guix repl` instead of `guile`. https://mastodon.social/@Z572/112195758829383364
