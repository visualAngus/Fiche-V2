let liste_color_pastel = ['#99dcf5', '#c6d47e', '#f2dc3d', '#bdb0a9', '#fbb990', '#ffffff', '#000'];
let color_global = 0;
let fiche_id = new URLSearchParams(window.location.search).get('id');

async function getFiche() {
    const response = await fetch(`/historique_api?id=${fiche_id}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });
    const data = await response.json();
    if (response.ok) {
        console.log(data);
        const version = data.version.version;
        document.querySelector('.slider').max = version;
        document.querySelector('.slider').value = version;
        document.querySelector('#version_choisie').textContent = version;
        get_JSON_fiche();
    } else {
        console.log(data);
    }
}

async function get_JSON_fiche() {
    // get les param de l'url
    const id_fiche = fiche_id;
    const response = await fetch(`/get_fiche?id=${id_fiche}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });
    const data = await response.json();
    if (response.ok) {
        fiche = data.fiche;
        fiche_contenu = fiche.fiche_content_only;
        fiche_contenu = fiche_contenu.JSON_Storage;
        if (fiche_contenu == "") {
            fiche_contenu = {
                titre: "",
                groupe: "none",
                contenu: [
                ],
                date_creation: new Date().toISOString()
            };

            fiche_contenu = JSON.stringify(fiche_contenu);
        }
        // convert string to json
        localStorage.setItem('fiche', fiche_contenu);
        fiche = JSON.parse(fiche_contenu);
        load_local_storage(true);
        set_def_title();
    }
}

async function get_JSON_fiche_by_version(version) {
    // get les param de l'url
    const id_fiche = fiche_id;
    const response = await fetch(`/get_fiche_by_version?id=${id_fiche}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ version: version })
    });
    const data = await response.json();
    if (response.ok) {
        fiche = data.fiche;
        fiche_contenu = fiche.fiche_content_only;
        fiche_contenu = fiche_contenu.JSON_Storage;
        if (fiche_contenu == "") {
            fiche_contenu = {
                titre: "",
                groupe: "none",
                contenu: [
                ],
                date_creation: new Date().toISOString()
            };

            fiche_contenu = JSON.stringify(fiche_contenu);
        }
        // convert string to json
        localStorage.setItem('fiche', fiche_contenu);
        fiche = JSON.parse(fiche_contenu);
        document.querySelector('.preview .content').innerHTML = "";
        load_local_storage(true);
        set_def_title();
    }
}

async function change_last_version() {
    const id_fiche = fiche_id;
    const version = document.querySelector('.slider').value;
    const response = await fetch(`/change_last_version?id=${id_fiche}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ version: version })
    });
    const data = await response.text();
    if (response.ok) {
        window.location.href = `/editor?id=${id_fiche}`;
    } else {
        console.log(data);
    }
}

function createEditorSection(element = "", content = "", id = "", color = "", nom = "",parent) {


    const preview = document.createElement('div');
    preview.className = 'preview_txt';
    preview.innerHTML = content;
    preview.id = id;

    parent.appendChild(preview);

    return;
}

function createEditorSectionDef(element = "", mot = "", content = "", id = "", color = 0, nom = "",parent) {


    const preview = document.createElement('div');
    preview.className = 'preview_def_main';
    preview.id = id;

    const preview_mot = document.createElement('div');
    preview_mot.className = 'preview_def_mot';
    preview_mot.innerHTML = mot;

    const preview_def = document.createElement('div');
    preview_def.className = 'preview_def';
    preview_def.innerHTML = content;

    preview.appendChild(preview_mot);
    preview.appendChild(preview_def);


    parent.appendChild(preview);

    return;
}

function createEditorSectionTitre(element = "", content = "", id = "", color = "", nom = "", titre_type = "h3",parent) {


    const preview = document.createElement('div');
    preview.className = 'preview_titre';
    preview.innerHTML = content;
    preview.id = id;

    if (color) {
        preview.style.color = liste_color_pastel[color];
    }

    preview.setAttribute('titre_type', titre_type);

    parent.appendChild(preview);
}

function load_local_storage(auto = "",parent) {
    const ficheJSONFromStorage = localStorage.getItem('fiche');
    const ficheFromStorage = JSON.parse(ficheJSONFromStorage);
    try {
        let titre_ = ficheFromStorage.titre;
        let titre__ = document.createElement('h1');
        titre__.textContent = titre_;
    titre__.className = 'titre';
        parent.appendChild(titre__);

        let fiche = ficheFromStorage.contenu;
        fiche.forEach(element => {
            console.log(element);
            let nom = element.id;
            if (element.type == "texte") {
                createEditorSection("", element.valeur, element.id, element.color, nom,parent);
            } else if (element.type == "definition") {
                createEditorSectionDef("", element.mot, element.valeur, element.id, element.color, nom,parent);
            } else if (element.type == "titre") {
                createEditorSectionTitre("", element.valeur, element.id, element.color, nom, element.titre_type,parent);
            }
        });
    } catch (error) {
        console.log(error);
        return;
    }

}

function add_definition_title(elem) {
    if (elem.querySelector(".div_def_fiche_title")) {
        return;
    }
    let div = document.createElement("div");
    div.className = "div_def_fiche_title";
    div.id = "divDefFicheTitle_" + elem.id;
    div.textContent = "Définitions";

    if (elem.getAttribute('color') == undefined) {
        elem.setAttribute('color', -1);
    }
    div.style.color = liste_color_pastel[elem.getAttribute('color')];

    console.log(elem.getAttribute('color'));
    div.addEventListener('click', function () {
        let bck_color = elem.getAttribute('color');
        if (parseInt(bck_color) + 1 >= liste_color_pastel.length) {
            elem.setAttribute('color', 0);
            bck_color = -1;
        }
        let next_color = liste_color_pastel[parseInt(bck_color) + 1];
        console.log(next_color);
        div.style.color = next_color;

        elem.setAttribute('color', parseInt(bck_color) + 1);

        //change the json 
        const element = fiche.contenu.find(element => element.id === elem.id);
        element.color = parseInt(bck_color) + 1;
        localStorage.setItem('fiche', JSON.stringify(fiche));
    });
    elem.appendChild(div);
}

function remove_definition_title(elem) {
    let div = elem.querySelector(".div_def_fiche_title");
    if (div) {
        div.remove();
    }
}

function set_def_title(new_div) {
    let fiche = localStorage.getItem('fiche');
    fiche = JSON.parse(fiche);
    let contenu = fiche.contenu;

    let list_def = [];

    contenu.forEach(elem => {
        if (elem.type == "definition") {
            list_def.push(elem);
            let id = list_def[0].id;
            let element = new_div.querySelector(`.parent_liste #${id}`);
            console.log(id);
            element.classList.remove('first_def');
            element.classList.remove('last_def');

            remove_definition_title(element);


            let last_id = list_def[list_def.length - 1].id;
            let last_element = new_div.querySelector(`.parent_liste #${last_id}`);
            last_element.classList.remove('last_def');
            last_element.classList.remove('first_def'); 

            remove_definition_title(last_element);

        } else if (list_def.length > 0) {
            let id = list_def[0].id;
            let element = new_div.querySelector(`.parent_liste #${id}`);
            element.classList.add('first_def');
            let color = list_def[0].color;
            console.log(color);
            element.setAttribute('color', color);
            add_definition_title(element);

            let last_id = list_def[list_def.length - 1].id;
            let last_element = new_div.querySelector(`.parent_liste #${last_id}`);
            last_element.classList.add('last_def');

            list_def = [];

        }


    });
    if (list_def.length > 0) {
        let id = list_def[0].id;
        let element = new_div.querySelector(`.parent_liste #${id}`);
        element.classList.add('first_def');
        let color = list_def[0].color;
        element.setAttribute('color', color);
        add_definition_title(element);


        let last_id = list_def[list_def.length - 1].id;
        let last_element = new_div.querySelector(`.parent_liste #${last_id}`);
        last_element.classList.add('last_def');

        list_def = [];

    }
}
