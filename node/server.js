const http = require('http');
const express = require('express');
const path = require('path');
const mysql = require('mysql');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const crypto = require('crypto');
const Joi = require('joi');

const hostname = '192.168.1.74';
const port = 3000;


const app = express();
const PORT = process.env.PORT || 3000;

const saltRounds = 20;
const SECRET_KEY = fs.readFileSync(path.join(__dirname, '../certs/private-key.pem'), 'utf8').trim();

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());
app.use(cookieParser());

// connect to the database
const connection_fiches = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'fiche_v2'
});
connection_fiches.connect(function (err) {
    if (err) {
        console.error('error connecting: ' + err.stack);
        return;
    }
    console.log('connected as id ' + connection_fiches.threadId);
});

const schema = Joi.object({
    query: Joi.string().required(),
    params: Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number())).required()
});

async function request_fiche(query, params = []) {
    const validation = schema.validate({ query, params });
    if (validation.error) {
        throw new Error(`Validation failed: ${validation.error.message}`);
    }

    return new Promise((resolve, reject) => {
        connection_fiches.query(query, params, (error, results) => {
            if (error) return reject(error);
            return resolve(results);
        });
    });
}


// const initDatabase = async () => {
//     // Table pour stocker les métadonnées des fiches
//     const createFichesMetaTable = `
//         CREATE TABLE IF NOT EXISTS fiches_meta (
//             id_fiche INT PRIMARY KEY AUTO_INCREMENT,
//             titre VARCHAR(255) NOT NULL,
//             table_name VARCHAR(255) NOT NULL,
//             date_creation TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//         )
//     `;

//     // Table de liaison entre utilisateurs et fiches
//     const createUserFichesTable = `
//         CREATE TABLE IF NOT EXISTS user_fiches (
//             id INT PRIMARY KEY AUTO_INCREMENT,
//             user_id INT,
//             fiche_id INT,
//             FOREIGN KEY (user_id) REFERENCES users(id),
//             FOREIGN KEY (fiche_id) REFERENCES fiches_meta(id_fiche),
//             date_attribution TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//         )
//     `;

//     try {
//         await connection_fiches.query(createFichesMetaTable);
//         await connection_fiches.query(createUserFichesTable);
//         console.log('Tables principales créées avec succès');
//     } catch (error) {
//         console.error('Erreur lors de la création des tables:', error);
//     }
// };

// initDatabase();
// lance le serveur
app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});

// GET request for the homepage
app.get('/', (req, res) => {
    res.redirect('/home');
});

// GET request for the editor
app.get('/editor', (req, res) => {
    // vérifie si le token est valide
    if (!verificationAll(req)) {
        res.redirect('/login');
    } else {
        res.sendFile(path.join(__dirname, '../editor/index.html'));
    }
});

// GET request for the login page
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../login/index.html'));
});

// POST request to login
app.post('/login_api', async (req, res) => {

    if (verificationAll(req)) {
        res.redirect('/home');
        return;
    }

    const { username, password } = req.body;
    if (!username){
        res.status(401).send('Invalid username or password');
        return;
    }

    const results_profil = await request_fiche("SELECT * FROM users WHERE BINARY username = ?",[username]);

    if (results_profil.length === 0) {
        res.status(401).send('Invalid username or password');
        return;
    } else {
        const { id, password: hash } = results_profil[0];
        const match = await verifyPassword(password, hash);
        if (!match) {
            res.status(401).send('Invalid username or password');
            return;
        }
        // Générer un token JWT
        const token = generateToken(username, id);
        // Générer une clé secondaire
        const secondaryKey = generateSecondaryKey(SECRET_KEY, password);

        // Stocker les données dans les cookies
        res.cookie('token', token, { maxAge: 3600000, sameSite: 'Lax' });
        res.cookie('secondaryKey', secondaryKey.toString('hex'), { maxAge: 3600000, sameSite: 'Lax' });

        return res.redirect('/home');
    }



});

// GET request for the home page
app.get('/home', (req, res) => {

    if (!verificationAll(req)) {
        res.redirect('/login');
    }

    res.sendFile(path.join(__dirname, '../home/index.html'));
});
// creation d'une fiche
app.post('/create_fiche', async (req, res) => {

    const userData = verificationAll(req);
    if (!userData) {
        res.status(401).send('Unauthorized');
        return;
    }

    const { title } = req.body;
    console.log(title)
    try {
        const tableName = `fiche_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        const creatFicheResultat =await request_fiche('INSERT INTO fiches_meta (titre, table_name) VALUES (?, ?)',[title, tableName]);

        // Créer la table spécifique pour cette fiche
        await createFicheTable(tableName);

        // Insérer la première version vide dans la table de la fiche
        await new Promise((resolve, reject) => {
            let fiche = {
                titre: "",
                groupe: "none",
                contenu: [],
                date_creation: new Date().toISOString()
            };
            fiche = JSON.stringify(fiche);
            connection_fiches.query(
                `INSERT INTO ${tableName} (inner_html, JSON_Storage, commentaire, iv_inner, authTag_inner, iv_local, authTag_local) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ['', fiche, 'Version initiale', '', '', '', ''],
                (error, results) => {
                    if (error) return reject(error);
                    resolve(results); 
                }
            );
        });
        await request_fiche("`INSERT INTO ${tableName} (inner_html, JSON_Storage, commentaire, iv_inner, authTag_inner, iv_local, authTag_local) VALUES (?, ?, ?, ?, ?, ?, ?)",['', fiche, 'Version initiale', '', '', '', '']);

        // Créer la liaison utilisateur-fiche
        await new Promise((resolve, reject) => {
            connection_fiches.query(
                'INSERT INTO user_fiches (user_id, fiche_id) VALUES (?, ?)',
                [userData.userID, creatFicheResultat.results.insertId],
                (error, results) => {
                    if (error) reject(error);
                    resolve(results);
                }
            );
        });
        res.json({
            success: true,
            ficheId: creatFicheResultat.results.insertId,
            message: 'Fiche créée avec succès'
        });

    }
    catch (error) {
        console.error('Erreur lors de la création de la fiche:', error);
        res.status(500).send('Erreur lors de la création de la fiche');
        return;
    }
});
app.get('/get_fiche', async (req, res) => {
    const userData = verificationAll(req);
    if (!userData) {
        res.status(401).send('Unauthorized');
        return;
    }

    const secondaryKey = Buffer.from(req.cookies.secondaryKey, 'hex');

    const ficheId = req.query.id;


    const fiche = await new Promise((resolve, reject) => {
        connection_fiches.query('SELECT * FROM fiches_meta WHERE id_fiche = ?', [ficheId], (error, results) => {
            if (error) return reject(error);
            resolve(results[0]);
        });
    });

    if (!fiche) {
        res.status(404).send('Fiche non trouvée');
        return;
    }

    const ficheTableName = fiche.table_name;

    const fiche_content = await new Promise((resolve, reject) => {
        connection_fiches.query(`SELECT * FROM ${ficheTableName} ORDER BY version_id DESC LIMIT 1`, (error, results) => {
            if (error) return reject(error);
            resolve(results);
        });
    });
    let fiche_content_only = fiche_content[0];
    let decryptedInnerHtml = fiche_content_only.inner_html;
    let decryptedLocalStorage = fiche_content_only.JSON_Storage;

    if (fiche_content_only.iv_inner && fiche_content_only.authTag_inner && fiche_content_only.iv_local && fiche_content_only.authTag_local) {
        decryptedInnerHtml = decryptWithSecondaryKey(fiche_content_only.inner_html, secondaryKey, fiche_content_only.iv_inner, fiche_content_only.authTag_inner);
        decryptedLocalStorage = decryptWithSecondaryKey(fiche_content_only.JSON_Storage, secondaryKey, fiche_content_only.iv_local, fiche_content_only.authTag_local);
    }
    fiche_content_only.inner_html = decryptedInnerHtml;
    fiche_content_only.JSON_Storage = decryptedLocalStorage;

    res.json({
        success: true,
        fiche: {
            ...fiche,
            fiche_content_only
        }
    });
});
app.post('/get_fiche_by_version', async (req, res) => {
    const userData = verificationAll(req);
    if (!userData) {
        res.status(401).send('Unauthorized');
        return;
    }

    const secondaryKey = Buffer.from(req.cookies.secondaryKey, 'hex');

    const ficheId = req.query.id;
    const versionId = req.body.version;


    const fiche = await new Promise((resolve, reject) => {
        connection_fiches.query('SELECT * FROM fiches_meta WHERE id_fiche = ?', [ficheId], (error, results) => {
            if (error) return reject(error);
            resolve(results[0]);
        });
    });

    if (!fiche) {
        res.status(404).send('Fiche non trouvée');
        return;
    }

    const ficheTableName = fiche.table_name;

    const fiche_content = await new Promise((resolve, reject) => {
        connection_fiches.query(`SELECT * FROM ${ficheTableName} WHERE version_id = ${versionId}`, (error, results) => {
            if (error) return reject(error);
            resolve(results);
        });
    });
    let fiche_content_only = fiche_content[0];
    let decryptedInnerHtml = fiche_content_only.inner_html;
    let decryptedLocalStorage = fiche_content_only.JSON_Storage;

    if (fiche_content_only.iv_inner && fiche_content_only.authTag_inner && fiche_content_only.iv_local && fiche_content_only.authTag_local) {
        decryptedInnerHtml = decryptWithSecondaryKey(fiche_content_only.inner_html, secondaryKey, fiche_content_only.iv_inner, fiche_content_only.authTag_inner);
        decryptedLocalStorage = decryptWithSecondaryKey(fiche_content_only.JSON_Storage, secondaryKey, fiche_content_only.iv_local, fiche_content_only.authTag_local);
    }
    fiche_content_only.inner_html = decryptedInnerHtml;
    fiche_content_only.JSON_Storage = decryptedLocalStorage;

    res.json({
        success: true,
        fiche: {
            ...fiche,
            fiche_content_only
        }
    });
});
app.post('/change_last_version', async (req, res) => {
    const userData = verificationAll(req);
    if (!userData) {
        res.status(401).send('Unauthorized');
        return;
    }

    const ficheId = req.query.id;
    const version = req.body.version;


    // copier la version selectionnée comme nouvelle version
    const fiche = await new Promise((resolve, reject) => {
        connection_fiches.query('SELECT * FROM fiches_meta WHERE id_fiche = ?', [ficheId], (error, results) => {
            if (error) return reject(error);
            resolve(results[0]);
        });
    });

    if (!fiche) {
        res.status(404).send('Fiche non trouvée');
        return;
    }

    const ficheTableName = fiche.table_name;

    const fiche_content = await new Promise((resolve, reject) => {
        connection_fiches.query(`SELECT * FROM ${ficheTableName} WHERE version_id = ${version}`, (error, results) => {
            if (error) return reject(error);
            resolve(results);
        });
    });

    const fiche_content_only = fiche_content[0];

    await new Promise((resolve, reject) => {
        connection_fiches.query(
            `INSERT INTO ${ficheTableName} (inner_html, JSON_Storage, commentaire, iv_inner, authTag_inner, iv_local, authTag_local) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [fiche_content_only.inner_html, fiche_content_only.JSON_Storage, fiche_content_only.commentaire, fiche_content_only.iv_inner, fiche_content_only.authTag_inner, fiche_content_only.iv_local, fiche_content_only.authTag_local],
            (error, results) => {
                if (error) return reject(error);
                resolve(results);
            }
        );
    });

    res.json({
        success: true,
        message: 'Version changée avec succès'
    });
});
app.get('/historique_api', async (req, res) => {
    const userData = verificationAll(req);
    if (!userData) {
        res.status(401).send('Unauthorized');
        return;
    }

    const secondaryKey = Buffer.from(req.cookies.secondaryKey, 'hex');

    const ficheId = req.query.id;


    const fiche = await new Promise((resolve, reject) => {
        connection_fiches.query('SELECT * FROM fiches_meta WHERE id_fiche = ?', [ficheId], (error, results) => {
            if (error) return reject(error);
            resolve(results[0]);
        });
    });

    if (!fiche) {
        res.status(404).send('Fiche non trouvée');
        return;
    }

    const ficheTableName = fiche.table_name;

    const fiche_content = await new Promise((resolve, reject) => {
        connection_fiches.query(`SELECT * FROM ${ficheTableName} ORDER BY version_id DESC LIMIT 1`, (error, results) => {
            if (error) return reject(error);
            resolve(results);
        });
    });
    let version = fiche_content[0].version_id;
    res.json({
        success: true,
        version: {
            version
        }
    });
});
app.get('/historique', async (req, res) => {
    const userData = verificationAll(req);
    if (!userData) {
        res.status(401).send('Unauthorized');
        return;
    }
    res.sendFile(path.join(__dirname, '../historique/index.html'));
});
app.post('/save_fiche', async (req, res) => {
    const userData = verificationAll(req);
    if (!userData) {
        res.status(401).send('Unauthorized');
        return;
    }

    const { ficheId, innerHTML, JSON_Storage, commentaire, versionId } = req.body;

    const fiche = await new Promise((resolve, reject) => {
        connection_fiches.query('SELECT * FROM fiches_meta WHERE id_fiche = ?', [ficheId], (error, results) => {
            if (error) return reject(error);
            resolve(results[0]);
        });
    });

    if (!fiche) {
        res.status(404).send('Fiche non trouvée');
        return;
    }

    const ficheTableName = fiche.table_name;

    const secondaryKey = Buffer.from(req.cookies.secondaryKey, 'hex');

    const { iv: iv_inner, encryptedData: inner_html, authTag: authTag_inner } = encryptWithSecondaryKey(innerHTML, secondaryKey);
    const { iv: iv_local, encryptedData: JSON_Storage_enc, authTag: authTag_local } = encryptWithSecondaryKey(JSON_Storage, secondaryKey);
    // console.log("la fiche ", ficheTableName," a été sauvegardée");
    try {
        await new Promise((resolve, reject) => {
            connection_fiches.query(
                `INSERT INTO ${ficheTableName} (inner_html, JSON_Storage, commentaire, iv_inner, authTag_inner, iv_local, authTag_local) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [inner_html, JSON_Storage_enc, commentaire, iv_inner, authTag_inner, iv_local, authTag_local],
                (error, results) => {
                    if (error) return reject(error);
                    resolve(results);
                }
            );
        });

        res.json({
            success: true,
            message: 'Fiche sauvegardée avec succès'
        });
    } catch (error) {
        console.error('Erreur lors de la sauvegarde de la fiche:', error);
        res.status(500).send('Erreur lors de la sauvegarde de la fiche');
    }
});
app.get("/get_all_fiche_by_user", async (req, res) => {
    const userData = verificationAll(req);
    if (!userData) {
        res.status(401).send('Unauthorized');
        return;
    }

    const secondaryKey = Buffer.from(req.cookies.secondaryKey, 'hex');

    try {
        const fiches = await new Promise((resolve, reject) => {
            connection_fiches.query('SELECT * FROM user_fiches WHERE user_id = ? ORDER BY date_attribution DESC', [userData.userID], (error, results) => {
                if (error) return reject(error);
                resolve(results);
            });
        });

        // Récupérer les métadonnées pour chaque fiche
        const fichesAvecMeta = await Promise.all(
            fiches.map(async (fiche) => {
                const ficheMeta = await new Promise((resolve, reject) => {
                    connection_fiches.query('SELECT * FROM fiches_meta WHERE id_fiche = ?', [fiche.fiche_id], (error, results) => {
                        if (error) return reject(error);
                        resolve(results[0]); // Supposons qu'il y ait une seule correspondance
                    });
                });
                return {
                    ...fiche,
                    meta: ficheMeta,
                };
            })
        );

        // Récupérer les données associées en fonction des métadonnées
        const fichesAvecDonnees = await Promise.all(
            fichesAvecMeta.map(async (fiche_meta) => {
                const tableName = fiche_meta.meta.table_name;
                // Valider le nom de la table
                if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
                    throw new Error('Nom de table invalide détecté.');
                }

                const ficheDonnees = await new Promise((resolve, reject) => {
                    const query = `SELECT * FROM ${tableName} ORDER BY version_id DESC `;
                    connection_fiches.query(query, (error, results) => {
                        if (error) return reject(error);
                        resolve(results[0]);
                    });
                });

                if (ficheDonnees.iv_local) {
                    const original_donne = ficheDonnees.JSON_Storage;
                    const iv = ficheDonnees.iv_local;
                    const authTag = ficheDonnees.authTag_local;
                    const decrip_donne = decryptWithSecondaryKey(original_donne, secondaryKey, iv, authTag)

                    ficheDonnees.JSON_Storage = decrip_donne;
                }
                return {
                    id_fiche: fiche_meta.fiche_id,
                    donnees: ficheDonnees,
                };
            })
        );
        res.json(fichesAvecDonnees); // Retourner toutes les fiches avec métadonnées et données associées
    } catch (error) {
        console.error(error);
        res.status(500).send('Erreur interne du serveur');
    }
});
app.delete('/delete_fiche', async (req, res) => {
    const userData = verificationAll(req);
    if (!userData) {
        res.status(401).send('Unauthorized');
        return;
    }

    const ficheId = req.query.id;

    if (!ficheId) {
        res.status(400).send('ID de la fiche requis');
        return;
    }

    try {
        // Vérifier si la fiche appartient à l'utilisateur
        const ficheVerif = await new Promise((resolve, reject) => {
            connection_fiches.query(
                'SELECT * FROM user_fiches WHERE fiche_id = ? AND user_id = ?',
                [ficheId, userData.userID],
                (error, results) => {
                    if (error) return reject(error);
                    resolve(results[0]);
                }
            );
        });

        if (!ficheVerif) {
            res.status(403).send('La fiche ne vous appartient pas');
            return;
        }

        // Récupérer les métadonnées de la fiche
        const fiche = await new Promise((resolve, reject) => {
            connection_fiches.query(
                'SELECT * FROM fiches_meta WHERE id_fiche = ?',
                [ficheId],
                (error, results) => {
                    if (error) return reject(error);
                    resolve(results[0]);
                }
            );
        });

        if (!fiche) {
            res.status(404).send('Fiche non trouvée');
            return;
        }

        const ficheTableName = fiche.table_name;

        // Supprimer la table associée à la fiche de manière sécurisée
        if (ficheTableName) {
            await new Promise((resolve, reject) => {
                connection_fiches.query(
                    `DROP TABLE IF EXISTS \`${ficheTableName}\``,
                    (error, results) => {
                        if (error) return reject(error);
                        resolve(results);
                    }
                );
            });
        }

        // Supprimer la liaison utilisateur-fiche
        await new Promise((resolve, reject) => {
            connection_fiches.query(
                'DELETE FROM user_fiches WHERE fiche_id = ?',
                [ficheId],
                (error, results) => {
                    if (error) return reject(error);
                    resolve(results);
                }
            );
        });

        // Supprimer les métadonnées de la fiche
        await new Promise((resolve, reject) => {
            connection_fiches.query(
                'DELETE FROM fiches_meta WHERE id_fiche = ?',
                [ficheId],
                (error, results) => {
                    if (error) return reject(error);
                    resolve(results);
                }
            );
        });

        res.json({
            success: true,
            message: 'Fiche supprimée avec succès',
        });
    } catch (error) {
        console.error('Erreur lors de la suppression de la fiche :', error);
        res.status(500).send('Erreur lors de la suppression de la fiche');
    }
});
app.get('/GetAllGroupeByUser', async (req, res) => {
    const userData = verificationAll(req);
    if (!userData) {
        res.status(401).send('Unauthorized');
        return;
    }

    try {
        // D'abord, récupérer les informations de base des fiches
        const tablesInfo = await new Promise((resolve, reject) => {
            connection_fiches.query(
                `SELECT id_groupe, nom_groupe FROM groupe WHERE user_id = ?`,
                [userData.userID],
                (error, results) => {
                    if (error) reject(error);
                    resolve(results);
                }
            );
        });

        res.json({
            success: true,
            data: tablesInfo,
            message: tablesInfo.length === 0 ? 'Aucun groupe trouvé pour cet utilisateur' : undefined
        });
    } catch (error) {
        console.error('Erreur lors de la récupération:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération' });
    }
});
app.post("/create_groupe", async (req, res) => {
    const userData = verificationAll(req);
    if (!userData) {
        res.status(401).send('Unauthorized');
        return;
    }
    const nom = req.body.nom;

    try {
        // D'abord, récupérer les informations de base des fiches
        const creation = await new Promise((resolve, reject) => {
            connection_fiches.query(
                `INSERT INTO groupe (nom_groupe,user_id) VALUES (?,?)`,
                [nom, userData.userID],
                (error, results) => {
                    if (error) reject(error);
                    resolve(results);
                }
            );
        });

        res.json({
            success: true,
            data: creation.insertId
        });
    } catch (error) {
        console.error('Erreur lors de la récupération:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération' });
    }
});
app.get('/get_all_fiche_in_groupe', async (req, res) => {
    const userData = verificationAll(req);
    if (!userData) {
        res.status(401).send('Unauthorized');
        return;
    }
    const secondaryKey = Buffer.from(req.cookies.secondaryKey, 'hex');
    
    try {
        // D'abord, récupérer les informations de base des fiches
        const tablesInfo = await new Promise((resolve, reject) => {
            connection_fiches.query(
                `SELECT groupe.id_groupe, groupe.nom_groupe, fiches_meta.table_name,fiches_meta.id_fiche
                FROM groupe
                LEFT JOIN fiches_meta ON fiches_meta.groupe_id = groupe.id_groupe
                WHERE groupe.user_id = ?`,
                [userData.userID],
                (error, results) => {
                    if (error) reject(error);
                    resolve(results);
                }
            );
        });

        // Pour chaque groupe, récupérer la dernière version de chaque fiche
        const allGroupFiches = [];

        for (const group of tablesInfo) {
            const { id_groupe, nom_groupe, table_name,id_fiche } = group;

            // Vérifier que le nom de la table n'est pas null ou vide
            if (!table_name) {
                continue; // Passer au groupe suivant
            }

            // Récupérer la dernière version de la fiche pour chaque table (chaque fiche est dans sa propre table)
            const fichesVersion = await new Promise((resolve, reject) => {
                const query = `
                    SELECT *
                    FROM ${table_name}
                    ORDER BY version_id DESC
                    LIMIT 1
                `;
                
                connection_fiches.query(query, (error, results) => {
                    if (error) reject(error);
                    resolve(results);
                });
            });

            // Décryptage des fiches si nécessaire
            const fichesVersion_final = fichesVersion[0];
            if (fichesVersion_final && fichesVersion_final.iv_local) {
                const original_donne = fichesVersion_final.JSON_Storage;
                const iv = fichesVersion_final.iv_local;
                const authTag = fichesVersion_final.authTag_local;
                const decrip_donne = decryptWithSecondaryKey(original_donne, secondaryKey, iv, authTag);
                fichesVersion_final.JSON_Storage = decrip_donne;
                fichesVersion_final.id_fiche = id_fiche;
            }

            // Recherche si le groupe existe déjà dans la liste
            const existingGroup = allGroupFiches.find(g => g.id_groupe === id_groupe);

            // Si le groupe existe déjà, ajouter la fiche à sa liste de fiches
            if (existingGroup) {
                existingGroup.fiches.push(fichesVersion_final);
            } else {
                // Sinon, créer une nouvelle entrée pour ce groupe avec la fiche
                allGroupFiches.push({
                    id_groupe,
                    nom_groupe,
                    fiches: [fichesVersion_final],  // Tableau de fiches
                });
            }
        }

        // Envoi de la réponse avec toutes les informations des groupes et leurs dernières fiches
        res.json(allGroupFiches);

    } catch (error) {
        console.error('Erreur lors de la récupération:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération' });
    }
});
app.post('/ChangeGroupeByID', async (req, res) => {
    const userData = verificationAll(req);
    if (!userData) {
        res.status(401).send('Unauthorized');
        return;
    }

    const id = req.body.id;
    const groupe_id = req.body.groupe_id;

    try {
        const fiches = await new Promise((resolve, reject) => {
            connection_fiches.query(`UPDATE fiches_meta SET groupe_id = ? WHERE id_fiche = ?`, [groupe_id,id], (error, results) => {
                if (error) return reject(error);
                resolve(results);
            });
        });

        res.json({
            success: true,
            message: 'Groupe changé'
        });
    }catch (error) {
        console.error('Erreur lors de la récupération:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération' });
    }
});



// FONCTION------------------------------------------------------------------------------------------------------------------------------
// Fonction pour créer une table de fiches
const createFicheTable = async (tableName) => {
    const createTableQuery = `
        CREATE TABLE ${tableName} (
            version_id INT PRIMARY KEY AUTO_INCREMENT,
            inner_html TEXT,
            JSON_Storage TEXT,
            date_modification TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            commentaire VARCHAR(255),
            iv_inner VARCHAR(255),
            authTag_inner VARCHAR(255),
            iv_local VARCHAR(255),
            authTag_local VARCHAR(255)
        )
    `;

    return new Promise((resolve, reject) => {
        connection_fiches.query(createTableQuery, (error) => {
            if (error) reject(error);
            resolve();
        });
    });
};

// fonction de hashage du mot de passe
async function hashPassword(password) {
    const hash = await bcrypt.hash(password, saltRounds);
    return hash;
}

// fonction de vérification du mot de passe
async function verifyPassword(password, hash) {
    const match = await bcrypt.compare(password, hash);
    return match;
}

// Fonction pour générer un token JWT
function generateToken(name, id) {
    const payload = {
        username: name,
        userID: id,
        role: "admin"
    };
    const options = { expiresIn: '1h' };;
    return jwt.sign(payload, SECRET_KEY, options);
}

// Fonction pour vérifier un token JWT
function verifyToken(token) {
    try {
        return jwt.verify(token, SECRET_KEY); // Vérifie le token et retourne son contenu décodé si valide
    } catch (error) {
        return null; // Retourne null si le token est invalide ou expiré
    }
}

// fonction pour tout verifier
function verificationAll(req) {
    // get le token 
    const token = req.cookies.token;
    //get la clé secondaire
    const secondaryKey = req.cookies.secondaryKey;

    if (!token) {
        return false;
    } else if (!secondaryKey) {
        return false;
    }

    const data = verifyToken(token);
    if (!data) {
        return false;
    }

    return data;
}

// Fonction pour générer une clé secondaire à partir de la clé primaire et du mot de passe
function generateSecondaryKey(primaryKey, password) {
    const salt = crypto.createHash('sha256').update(primaryKey).digest('hex'); // Utiliser une valeur unique pour chaque clé primaire
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256'); // Génère une clé de 32 octets (256 bits)
}

// Fonction pour chiffrer le texte avec la clé secondaire
function encryptWithSecondaryKey(text, secondaryKey) {
    const iv = crypto.randomBytes(16); // Génère un IV aléatoire
    const cipher = crypto.createCipheriv('aes-256-gcm', secondaryKey, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex'); // Tag pour vérifier l'intégrité du chiffrement

    return {
        iv: iv.toString('hex'),
        encryptedData: encrypted,
        authTag: authTag
    };
}

// Fonction pour déchiffrer le texte avec la clé secondaire
function decryptWithSecondaryKey(encryptedData, secondaryKey, iv, authTag) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', secondaryKey, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}