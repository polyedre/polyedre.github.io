---
title: Using multiple kubectl contexts at the same time
date: 2023-07-15
draft: false
---

Kubernetes clusters rarely come alone. If you have access to at least one, in no
time you'll need to switch your kubectl context to access other clusters.

But what if you need to access two clusters *simultaneously*?

This is a problem I had multiple times per week (even per day) for a few months.
When comparing two Kubernetes clusters, if often had to switch the kubectl context
between each command.

```sh
$ # Some pod cannot start on clusterA, let's compare the quota allocated on clusterB
$ kubetctx clusterA
$ kubectl get quota
$ kubectx clusterB
$ kubectl get quota
$ # No difference constated, let's check if the number of replica is different
$ kubetctx clusterA
$ kubectl get deploy
$ kubectx clusterB
$ kubectl get deploy
$ # Etc
```

To reduce the number of context switching, I need to be able to start two
terminals: one by kubectl context.

Here is my quick solution (I use ZSH, so the autocompletion will not work if you
use bash or fish):

```sh
ktx-init() {
  current_context=$(cat ~/.kube/config | yq '.current-context')

  for context in $(cat ~/.kube/config | yq '.contexts[].name'); do
    KUBECONFIG=~/.kube/config kubectx $context

    cp ~/.kube/config /tmp/k8s_context_$context
  done

  KUBECONFIG=~/.kube/config kubectx $current_context
}

ktx() {
  export KUBECONFIG=/tmp/k8s_context_$1
}

_ktx() {
  compadd "$@" $(ls /tmp | grep k8s_context | sed 's/k8s_context_//')
}

compdef _ktx ktx
```

After sourcing your ZSH config again, run the `ktx-init` command. It reads all
the context stored in your file `~/.kube/config` and create a kubeconfig file for
each context.

After, you can just switch context in each of the terminals with `ktx <CONTEXT-NAME>`.

I did not expect this improvement to my workflow to be this easy. If I had known
I would have written this function months ago! 
