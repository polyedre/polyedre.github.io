---
title: "À la recherche du workflow GPG parfait (Partie 1)"
date: 2022-03-29T00:00:00+01:00
draft: false
---

Les outils pour créer des clés GPG existent depuis une vingtaine d'années
maintenant, et pourtant la gestion des clés est toujours aussi rugueuse. Dans
cet article je vais essayer de résumer tout ce que j'ai compris et mis en place
pour respecter les *Best Practices*.

Pour résumer, après avoir configurer GPG, je vais créer une clé primaire, 3
sous-clés spécifiques à chaque usage puis la clé primaire sera sauvegardée sur
un support offline et retirée du trousseau.

## Contexte

Pour la petite histoire, la version 1.0 du logiciel PGP, pour *Pretty Good Privacy*,
a été publiée en 1991 par Philip Zimmermann. L'objectif principal du logiciel
était de permettre le chiffrement des messages électroniques. Bien que le
logiciel était alors gratuit et que le code source était publique pour être
auditable, il n'était pas libre et quelques années plus tard, une version libre
est apparue : Gnu Privacy Guard, que je vais utiliser dans cet article. Le
fonctionnement du logiciel a été standardisé grâce aux RFC
[2440](https://datatracker.ietf.org/doc/html/rfc2440) et
[4880](https://datatracker.ietf.org/doc/html/rfc4880).

## Génération de la clé primaire

Je créé une clé primaire qui n'aura qu'une seule permission : le droit de
certifier. Cette clé sera stockée uniquement hors-ligne et est l'élément le plus
important puisqu'elle contiendra l'identité associée à la clé. En cas de perte
ou si elle est compromise, c'est l'identité associée qui sera impactée. Les
opérations du quotidien seront réalisées avec des sous-clés et en cas de
compromission d'une des clés ou si je souhaite étendre la durée d'expiration
d'une clé, j'utiliserais la clé primaire pour réaliser les actions nécessaires.

Pour éviter d'impacter le trousseau de clés déjà potentiellement présent sur la
machine et pour être certain que la clé primaire ne sera jamais présente dans le
trousseau, je vais créer un nouveau trousseau dans un dossier temporaire :

```sh
export GNUPGHOME=$(mktemp -d)
```

Toutes les commandes GPG vont maintenant utiliser ce nouveau trousseau pour
toute la session shell.

Je créé la clé primaire en spécifiant le mode expert :

```sh
polyedre@machine $ gpg --full-gen-key --expert
gpg (GnuPG) 2.2.19; Copyright (C) 2019 Free Software Foundation, Inc.
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.

Please select what kind of key you want:
   (1) RSA and RSA (default)
   (2) DSA and Elgamal
   (3) DSA (sign only)
   (4) RSA (sign only)
   (7) DSA (set your own capabilities)
   (8) RSA (set your own capabilities)
   (9) ECC and ECC
  (10) ECC (sign only)
  (11) ECC (set your own capabilities)
  (13) Existing key
  (14) Existing key from card
Your selection? 8

Possible actions for a RSA key: Sign Certify Encrypt Authenticate 
Current allowed actions: Sign Certify Encrypt 

   (S) Toggle the sign capability
   (E) Toggle the encrypt capability
   (A) Toggle the authenticate capability
   (Q) Finished

Your selection? S

Possible actions for a RSA key: Sign Certify Encrypt Authenticate 
Current allowed actions: Certify Encrypt 

   (S) Toggle the sign capability
   (E) Toggle the encrypt capability
   (A) Toggle the authenticate capability
   (Q) Finished

Your selection? E

Possible actions for a RSA key: Sign Certify Encrypt Authenticate 
Current allowed actions: Certify 

   (S) Toggle the sign capability
   (E) Toggle the encrypt capability
   (A) Toggle the authenticate capability
   (Q) Finished

Your selection? q
RSA keys may be between 1024 and 4096 bits long.
What keysize do you want? (3072) 4096
Requested keysize is 4096 bits
Please specify how long the key should be valid.
         0 = key does not expire
      <n>  = key expires in n days
      <n>w = key expires in n weeks
      <n>m = key expires in n months
      <n>y = key expires in n years
Key is valid for? (0) 2y
Key expires at jeu. 28 mars 2024 18:14:18 CET
Is this correct? (y/N) y

GnuPG needs to construct a user ID to identify your key.

Real name: Polyedre
Email address: polyedre@disroot.org
Comment: 
You selected this USER-ID:
    "Polyedre <polyedre@disroot.org>"

Change (N)ame, (C)omment, (E)mail or (O)kay/(Q)uit? O
We need to generate a lot of random bytes. It is a good idea to perform
some other action (type on the keyboard, move the mouse, utilize the
disks) during the prime generation; this gives the random number
generator a better chance to gain enough entropy.
gpg: key A5A6C67955F8B4E0 marked as ultimately trusted
gpg: directory '/tmp/tmp.0CxKFYVfeQ/openpgp-revocs.d' created
gpg: revocation certificate stored as '/tmp/tmp.0CxKFYVfeQ/openpgp-revocs.d/047B26A2BEDA629EE7EE8173A5A6C67955F8B4E0.rev'
public and secret key created and signed.

pub   rsa4096 2022-03-29 [C] [expires: 2024-03-28]
      047B26A2BEDA629EE7EE8173A5A6C67955F8B4E0
uid                      Polyedre <polyedre@disroot.org>
```

Voici comment j'ai procédé :

1. J'ai sélectionné l'option **(8) RSA (set your own capabilities)**.
1. J'ai désactivé la possibilité de signer et de chiffrer avec cette clé
   primaire en répondant **S** et **E**, puis **q** pour valider.
1. J'ai choisi une date d'expiration de 2 ans. Configurer une date d'expiration
   permet de rendre la clé inutilisable lorsqu'elle est perdue et qu'il n'y a
   plus aucune possibilité de la révoquer. Il sera nécessaire d'étendre
   régulièrement la date d'expiration de la clé pour éviter qu'elle n'expire
   alors qu'elle est toujours en activité. Cette opération étant un peu
   contraignante, je trouve qu'une valeur de **2 ans** est un bon compromis.
1. Je valide la configuration de la clé.
1. Je complète le nom et l'adresse email associée à cette identité. Comme je
   souhaite que cette identité ne soit pas reliée explicitement à mon identité
   administrative, j'utilise ici mon pseudonyme.
1. Je valide ces informations avec **O**, j'attend quelques secondes que le
   programme récupère suffisament d'entropie sur ma machine pour créer la clé,
   je rentre le mot de passe de cette clé et voilà !

La clé peut maintenant être affichée :

```sh
polyedre@machine $ gpg -k
/tmp/tmp.0CxKFYVfeQ/pubring.kbx
-------------------------------
pub   rsa4096 2022-03-29 [C] [expires: 2024-03-28]
      047B26A2BEDA629EE7EE8173A5A6C67955F8B4E0
uid           [ultimate] Polyedre <polyedre@disroot.org>
```

## Création des sous-clés

Je vais créer 3 sous-clés : une pour chaque usage. L'objectif c'est qu'en cas de
compromission d'une des clés, les autres fonctionnalités soient le moins
impactées possibles.

Je lance le programme GPG en mode intéractif et lui demande d'éditer la clé GPG.

```sh
polyedre@machine $ gpg --expert --edit-key polyedre@disroot.org
gpg (GnuPG) 2.2.19; Copyright (C) 2019 Free Software Foundation, Inc.
This is free software: you are free to change and redistribute it.
There is NO WARRANTY, to the extent permitted by law.

Secret key is available.

sec  rsa4096/A5A6C67955F8B4E0
     created: 2022-03-29  expires: 2024-03-28  usage: C
     trust: ultimate      validity: ultimate
[ultimate] (1). Polyedre <polyedre@disroot.org>

gpg> addkey
Please select what kind of key you want:
   (3) DSA (sign only)
   (4) RSA (sign only)
   (5) Elgamal (encrypt only)
   (6) RSA (encrypt only)
   (7) DSA (set your own capabilities)
   (8) RSA (set your own capabilities)
  (10) ECC (sign only)
  (11) ECC (set your own capabilities)
  (12) ECC (encrypt only)
  (13) Existing key
  (14) Existing key from card
Your selection? 8

Possible actions for a RSA key: Sign Encrypt Authenticate 
Current allowed actions: Sign Encrypt 

   (S) Toggle the sign capability
   (E) Toggle the encrypt capability
   (A) Toggle the authenticate capability
   (Q) Finished

Your selection? e

Possible actions for a RSA key: Sign Encrypt Authenticate 
Current allowed actions: Sign 

   (S) Toggle the sign capability
   (E) Toggle the encrypt capability
   (A) Toggle the authenticate capability
   (Q) Finished

Your selection? q
RSA keys may be between 1024 and 4096 bits long.
What keysize do you want? (3072) 4096
Requested keysize is 4096 bits
Please specify how long the key should be valid.
         0 = key does not expire
      <n>  = key expires in n days
      <n>w = key expires in n weeks
      <n>m = key expires in n months
      <n>y = key expires in n years
Key is valid for? (0) 1y
Key expires at mer. 29 mars 2023 19:33:29 CEST
Is this correct? (y/N) y
Really create? (y/N) y
We need to generate a lot of random bytes. It is a good idea to perform
some other action (type on the keyboard, move the mouse, utilize the
disks) during the prime generation; this gives the random number
generator a better chance to gain enough entropy.

sec  rsa4096/A5A6C67955F8B4E0
     created: 2022-03-29  expires: 2024-03-28  usage: C
     trust: ultimate      validity: ultimate
ssb  rsa4096/A9DF7D449CE98AB6
     created: 2022-03-29  expires: 2023-03-29  usage: S
[ultimate] (1). Polyedre <polyedre@disroot.org>

```

Voici ce que j'ai fais :

1. Je demande à créer une sous-clé avec la commande `addkey`.
1. Par défaut la clé peut signer et chiffrer, je retire la possibilité de
   chiffrer avec **e**.
1. Il ne reste plus que le rôle de signature pour la clé, je valide avec **q**.
1. Je choisi une durée d'expiration d'un an, je valide puis la sous-clé est
   créé.
   
Après avoir réitéré l'opération pour créer une clé de chiffrement et une clé
pour l'authentification, je me retrouve avec une clé primaire et 3 sous-clés.

Je peux sauvegarder et quitter avec `save`.

```sh
polyedre@machine $ gpg -k
/tmp/tmp.0CxKFYVfeQ/pubring.kbx
-------------------------------
pub   rsa4096 2022-03-29 [C] [expires: 2024-03-28]
      047B26A2BEDA629EE7EE8173A5A6C67955F8B4E0
uid           [ultimate] Polyedre <polyedre@disroot.org>
sub   rsa4096 2022-03-29 [S] [expires: 2023-03-29]
sub   rsa4096 2022-03-29 [E] [expires: 2023-03-29]
sub   rsa4096 2022-03-29 [A] [expires: 2023-03-29]
```

Dans la prochaine partie, je vais sauvegarder les clés et importer les 3
sous-clé dans mon trousseau par défaut.
