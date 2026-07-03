# 🐍 THE TANGLE

![Status](https://img.shields.io/badge/Status-Finished-success)
![Tech](https://img.shields.io/badge/Built%20With-HTML5%20%7C%20CSS3%20%7C%20JS-blueviolet)
![Vibe](https://img.shields.io/badge/Vibe-Retro%20%2F%20Cyberpunk-00ff9d)

> **Une réinterprétation moderne et "High Voltage" du classique Snake, développée en Vanilla JS.**

## 🎮 Aperçu

**Tangle Game** plonge le joueur dans une interface système rétro-futuriste. Le but est de guider le "Cyber-Cobra" pour collecter des paquets de données (nourriture) tout en évitant les murs et sa propre queue qui s'allonge indéfiniment.

Le jeu se distingue par son ambiance **Dark Synthwave**, son moteur audio procédural (Chiptune généré par le code) et ses visuels néons fluides.

  <p align="center">
    <a href="https://goken-0.github.io/thetangle/">
      <img src="https://img.shields.io/badge/Tester_le_jeu-000000?style=for-the-badge&logo=github&logoColor=white" alt="Live Demo">
    </a>
  </p>

<img width="2555" height="1271" alt="image" src="https://github.com/user-attachments/assets/fe3f3e2b-c433-4583-a810-83c35de31160" />

## ✨ Fonctionnalités

* **Moteur Graphique 100% Canvas :** Rendu fluide à 60 FPS avec effets de lueur (Glow) et particules.
* **Audio Procédural (Web Audio API) :** Pas de fichiers MP3 lourds. La musique et les bruitages (8-bit style) sont générés en temps réel par le code.
* **Interface Réactive :** HUD dynamique, contrôles de volume avec slider au survol, et mode plein écran immersif.
* **Gameplay Ajusté :** Système de file d'attente (Input Buffer) pour des contrôles ultra-réactifs sans latence.
* **Ambiance Rétro :** Police pixel art ("Press Start 2P"), effet grille CRT et scanlines.

## 🕹️ Comment Jouer

L'objectif est simple : mangez les hexagones rouges pour augmenter votre score. Ne touchez pas les murs ni votre queue.

| Action | Touches Clavier |
| :--- | :--- |
| **Haut** | `Z` / `W` / `Flèche Haut` |
| **Bas** | `S` / `Flèche Bas` |
| **Gauche** | `Q` / `A` / `Flèche Gauche` |
| **Droite** | `D` / `Flèche Droite` |
| **Volume** | Slider via l'icône son |
| **Plein Écran** | Bouton interface |

## 🚀 Installation & Lancement

Ce projet est statique, il ne nécessite aucun serveur backend (Node.js, PHP, etc.).

1.  **Cloner le projet :**
    ```bash
    git clone [https://github.com/goken-0/thetangle.git](https://github.com/goken-0/thetangle.git)
    ```
2.  **Lancer le jeu :**
    * Ouvrez simplement le fichier `index.html` dans votre navigateur web (Chrome, Firefox, Edge).
    * *Optionnel :* Utilisez l'extension "Live Server" sur VS Code pour une meilleure expérience de développement.

## 📂 Structure du projet
Voici l'organisation des fichiers telle qu'elle est sur le dépôt :

```bash
Portfolio/
├── assets/                     # Images
├── favicon/                    # Icones
├── js/                     # Script JS du jeu
├── css/                        # Feuilles de styles (style.css)
│
├── index.html                  # Page HTML du jeu
│
└── README.md                   # Ce fichier (présentation du projet)
```

* `index.html` : Structure de la page, conteneur du jeu et interface (HUD).
* `style.css` : Design global, animations CSS, effets néons et gestion du responsive.
* `game.js` : Toute la logique du jeu (boucle principale, physique, dessin Canvas, synthétiseur audio).
* `/favicon/` : Icônes pour navigateurs et mobiles (Pixel Art Joystick).

## 🛠️ Configuration

Vous pouvez modifier les paramètres de jeu directement dans le fichier `game.js` (Lignes 4-9) :

```javascript
const SETTINGS = {
    grid: 40,           // Taille de la grille
    baseSize: 16,       // Épaisseur du serpent
    glow: true          // Effet néon (true/false)
};


const GAME_SPEED = 2;   // Vitesse de déplacement
```

<div align="center"> <small>Fait avec ❤️ par Goken-0 - 2025</small> </div>


