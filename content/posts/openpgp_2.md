---
title: "À la recherche du workflow GPG parfait (Partie 2)"
date: 2022-04-29T00:00:00+01:00
draft: false
---

Dans la [partie précédente](openpgp_1.md), j'ai créé paire de clé GPG primaire,
puis 3 clés secondaires pour chaque usage : signer, chiffrer et authentifier. Je
peux maintenant sauvegarder la clé primaire sur un support physique déconnecté
d'internet et la retirer du trousseau des clés.

En cas de maintenance sur les clés secondaires, comme une extension de leur
durée de validité ou encore leur renouvellement, il sera nécessaire d'utiliser
la clé principale, et nous allons voir comment le faire.

## Choix du support

Plusieurs supports sont disponibles pour sauvegarder la clé primaire. Plusieurs
facteurs sont à prendre en compte et qui peuvent être organisés sous le spectre
de l'acronyme CIA, pour Confidentiality, Integrity, et Availability
(Confidentialité, Intégrité et Disponibilité pour les non-bilingues) :

- Concernant la confidentialité, il est évident que je ne souhaite pas qu'une
  personne malintentionnée puisse facilement accéder cette clé. Dans mon modèle
  de sécuritè, je considère irréaliste le fait qu'une personne entre par
  effraction chez moi pour voler cette clé.

- Concernant la disponibilité, il faut que la clé puisse être accédée pendant au
  moins 2 ans, puisque c'est la durée pendant laquelle elle a été configurée
  pour être valide (voir la partie précédente). Le fichier doit être accessible
  depuis chez moi et je ne pense pas qu'il soit nécessaire d'y accéder depuis un
  autre endroit.

- L'intégrité de la clé est assurée par le fait que la clé publique est
  accessible indépendamment de la clé et qu'il est possible de vérifier
  facilement si la clé publique correspond à la clé privée.

On va être honnête, c'est beaucoup de blabla juste pour annoncer que par soucis
de simplicité, la clé primaire va être sauvegardée sur une clé USB. Pour le fun,
je vais aussi la sauvegarder sur un format papier, mais ça sera peut-être pour
une autre fois.

## Sauvegarde et suppression de la clé primaire

Pour sauvegarder la clé primaire, rien de plus simple. La commande suivante
permet d'exporter la clé privée dans un fichier :

```sh
gpg --armor --export-secret-keys "polyedre@disroot.org" > polyedre.key
```

Il suffit ensuite de placer ce fichier sur une clé USB.

Sauvegardons également les clés secondaires dans leur fichier.

```sh
gpg --armor --export-secret-subkeys "polyedre@disroot.org" > polyedre.subkeys
```

Je peut maintenant importer ces clés dans le trousseau par défaut du système.
Rappelons-nous, dans la partie 1, la clé PGP a été générée dans un trousseau
temporaire.

```sh
unset GNUPGHOME
gpg --import polyedre.subkeys
```

Et voilà !

Mes clés sont importées et disponibles :

```sh
polyedre@machine $ gpg --list-secret-keys
/home/polyedre/.gnupg/pubring.kbx
------------------------------
sec#  rsa4096 2022-04-30 [C] [expires: 2024-04-29]
      054350865F0474F5D2497D69913174CACD67AE0F
uid           [ unknown] Polyedre <polyedre@disroot.org>
ssb   rsa4096 2022-04-30 [S] [expires: 2023-04-30]
ssb   rsa4096 2022-04-30 [E] [expires: 2023-04-30]
ssb   rsa4096 2022-04-30 [A] [expires: 2023-04-30]
```

On remarquera la présence du croisillon (`#`) indiquant que la clé privée
principale n'est pas présente dans le trousseau.

## Utiliser la clé primaire

Les 3 clés secondaires peuvent maintenant être utilisées normalement. Comme
promis, voyons comment utiliser la clé primaire pour modifier les clés
secondaires.

Je ne veux pas que ma clé primaire soit dans le trousseau su système, donc comme
pour la partie 1, je vais créer un trousseau temporaire.

```sh
export GNUPGHOME=$(mktemp -d)
```

J'y importe la clé primaire sauvegardée sur la clé USB.

```sh
gpg --import polyedre.key
```

Automatiquement, les clés secondaires sont disponibles :

```sh
polyedre@machine $ gpg --list-secret-keys
/tmp/tmp.7pQf2b7qXY/pubring.kbx
-------------------------------
sec   rsa4096 2022-04-30 [C] [expires: 2024-04-29]
      054350865F0474F5D2497D69913174CACD67AE0F
uid           [ unknown] Polyedre <polyedre@disroot.org>
ssb   rsa4096 2022-04-30 [S] [expires: 2023-04-30]
ssb   rsa4096 2022-04-30 [E] [expires: 2023-04-30]
ssb   rsa4096 2022-04-30 [A] [expires: 2023-04-30]
```

Je peux ensuite augmenter la durée de validité d'une des clés secondaires :

```sh
polyedre@machine $ gpg --edit-key polyedre@disroot.org
Secret key is available.

sec  rsa4096/913174CACD67AE0F
     created: 2022-04-30  expires: 2024-04-29  usage: C
     trust: unknown       validity: unknown
ssb  rsa4096/505199DE46ABA45C
     created: 2022-04-30  expires: 2023-04-30  usage: S
ssb  rsa4096/8CDCD83070A02AFB
     created: 2022-04-30  expires: 2023-04-30  usage: E
ssb  rsa4096/41C03C2FDB86A1EC
     created: 2022-04-30  expires: 2023-04-30  usage: A
[ unknown] (1). Polyedre <polyedre@disroot.org>

gpg> key 1

sec  rsa4096/913174CACD67AE0F
     created: 2022-04-30  expires: 2024-04-29  usage: C
     trust: unknown       validity: unknown
ssb* rsa4096/505199DE46ABA45C
     created: 2022-04-30  expires: 2023-04-30  usage: S
ssb  rsa4096/8CDCD83070A02AFB
     created: 2022-04-30  expires: 2023-04-30  usage: E
ssb  rsa4096/41C03C2FDB86A1EC
     created: 2022-04-30  expires: 2023-04-30  usage: A
[ unknown] (1). Polyedre <polyedre@disroot.org>

gpg> expire
Changing expiration time for a subkey.
Please specify how long the key should be valid.
         0 = key does not expire
      <n>  = key expires in n days
      <n>w = key expires in n weeks
      <n>m = key expires in n months
      <n>y = key expires in n years
Key is valid for? (0) 1w
Key expires at sam. 07 mai 2022 21:32:06 CEST
Is this correct? (y/N) y

sec  rsa4096/913174CACD67AE0F
     created: 2022-04-30  expires: 2024-04-29  usage: C
     trust: unknown       validity: unknown
ssb* rsa4096/505199DE46ABA45C
     created: 2022-04-30  expires: 2022-05-07  usage: S
ssb  rsa4096/8CDCD83070A02AFB
     created: 2022-04-30  expires: 2023-04-30  usage: E
ssb  rsa4096/41C03C2FDB86A1EC
     created: 2022-04-30  expires: 2023-04-30  usage: A
[ unknown] (1). Polyedre <polyedre@disroot.org>

gpg> save
polyedre@machine $ gpg -K
gpg: checking the trustdb
gpg: no ultimately trusted keys found
/tmp/tmp.7pQf2b7qXY/pubring.kbx
-------------------------------
sec   rsa4096 2022-04-30 [C] [expires: 2024-04-29]
      054350865F0474F5D2497D69913174CACD67AE0F
uid           [ unknown] Polyedre <polyedre@disroot.org>
ssb   rsa4096 2022-04-30 [S] [expires: 2022-05-07]
ssb   rsa4096 2022-04-30 [E] [expires: 2023-04-30]
ssb   rsa4096 2022-04-30 [A] [expires: 2023-04-30]
```

Pour valider le changement, il suffit d'exporter à nouveau les clés secondaire
et de les importer dans le trousseau du système !

## conclusion

Et voilà, il reste une toute dernière étape : publier la clé publique sur un
serveur de clé.

```sh
polyedre@machine $ gpg --send-keys 054350865F0474F5D2497D69913174CACD67AE0F
gpg: sending key 913174CACD67AE0F to hkps://keys.openpgp.org
```

L'identifiant de la clé peut être obtenu en listant les clés privées. Dans mon
cas, l'auto-complétion de la commande m'a permis de selectionner la clé à
publier.
