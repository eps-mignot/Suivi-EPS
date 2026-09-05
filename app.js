/* ==========================================================================
   CARNET EPS — app.js
   Toute la logique : classes, séances, historique, bilans automatiques, PDF.
   Stockage : localStorage uniquement (fonctionnement 100% hors-ligne).
   ========================================================================== */
(function(){
"use strict";

/* ------------------------------------------------------------------ */
/* 1. BASE LOCALE : CLASSES ET APSA                                     */
/* Ces classes ne servent que de DONNEES D'EXEMPLE au premier lancement. */
/* Ensuite, la liste réelle vit dans localStorage et se modifie depuis  */
/* l'application (bouton "Gérer les classes / élèves"), ou par import  */
/* CSV (colonnes : classe,eleve).                                       */
/* ------------------------------------------------------------------ */
const DEFAULT_CLASSES = {
  "6A": ["Adam B.", "Chloé D.", "Ethan F.", "Inès G.", "Léo H.", "Manon J.", "Noah K.", "Sarah L."],
  "6B": ["Alice M.", "Bilal N.", "Camille O.", "Diego P.", "Emma Q.", "Farid R.", "Gabin S.", "Hana T."],
  "5A": ["Ilyes U.", "Jade V.", "Kylian W.", "Lina X.", "Mattéo Y.", "Nour Z.", "Oscar A.", "Priya B."],
  "5B": ["Quentin C.", "Rania D.", "Samuel E.", "Tessa F.", "Ugo G.", "Vera H.", "Wassim I.", "Yasmine J."],
  "4A": ["Axel K.", "Bianca L.", "Clément M.", "Dounia N.", "Enzo O.", "Fatou P.", "Gaspard Q.", "Hind R."],
  "4B": ["Idris S.", "Jeanne T.", "Kenza U.", "Louis V.", "Maya W.", "Nathan X.", "Olga Y.", "Paul Z."],
  "3A": ["Amine A.", "Béatrice B.", "Corentin C.", "Dania D.", "Eliott E.", "Fanny F.", "Ghali G.", "Héloïse H."],
  "3B": ["Imane I.", "Jules J.", "Kim K.", "Lucas L.", "Myriam M.", "Naël N.", "Océane O.", "Pablo P."]
};

const DEFAULT_APSA = [
  "Demi-fond", "Course d'orientation (CO)", "Handball", "Badminton",
  "Gymnastique", "Basketball", "Volleyball", "Football", "Rugby",
  "Danse", "Escalade", "Natation", "Athlétisme", "Acrosport", "Musculation"
];

const PRESENCE_LABELS = { present: "Présent", absent: "Absent", dispense: "Dispensé présent" };

/* ------------------------------------------------------------------ */
/* 2. STOCKAGE LOCAL                                                    */
/* ------------------------------------------------------------------ */
const LS_SEANCES = "eps_seances";
const LS_CARNET  = "eps_carnet";   // { "classe||apsa||Nom": "texte" } — 1 entrée par cycle
const LS_CLASSES = "eps_classes";  // { "6A": ["Nom1", "Nom2", ...], ... }
const LS_APSA    = "eps_apsa";     // ["Demi-fond", "Handball", ...]

function loadClassesData(){
  try {
    const raw = localStorage.getItem(LS_CLASSES);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && typeof parsed === "object") return parsed;
    }
  } catch(e){ /* données corrompues : on repart des exemples */ }
  const seeded = JSON.parse(JSON.stringify(DEFAULT_CLASSES));
  localStorage.setItem(LS_CLASSES, JSON.stringify(seeded));
  return seeded;
}
function saveClassesData(){
  localStorage.setItem(LS_CLASSES, JSON.stringify(CLASSES));
}

function loadApsaData(){
  try {
    const raw = localStorage.getItem(LS_APSA);
    if(raw){
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)) return parsed;
    }
  } catch(e){ /* données corrompues : on repart des exemples */ }
  const seeded = [...DEFAULT_APSA];
  localStorage.setItem(LS_APSA, JSON.stringify(seeded));
  return seeded;
}
function saveApsaData(){
  localStorage.setItem(LS_APSA, JSON.stringify(APSA_LIST));
}

// CLASSES et APSA_LIST sont mutables : ce sont les sources de vérité utilisées partout dans l'app.
let CLASSES = loadClassesData();
let APSA_LIST = loadApsaData();

function loadSeances(){
  try { return JSON.parse(localStorage.getItem(LS_SEANCES)) || []; }
  catch(e){ return []; }
}
function saveSeances(list){
  localStorage.setItem(LS_SEANCES, JSON.stringify(list));
}
function loadCarnet(){
  try { return JSON.parse(localStorage.getItem(LS_CARNET)) || {}; }
  catch(e){ return {}; }
}
function saveCarnet(obj){
  localStorage.setItem(LS_CARNET, JSON.stringify(obj));
}
/* Le carnet est évalué par cycle : une entrée distincte par élève, pour
   chaque combinaison classe + APSA. Ainsi un cycle Handball et un cycle
   Natation pour le même élève ne s'écrasent jamais l'un l'autre. */
function carnetKey(classe, apsa, eleve){
  return `${classe}||${apsa}||${eleve}`;
}

function uid(){
  return "s_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2,8);
}
function todayISO(){
  const d = new Date();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  return `${d.getFullYear()}-${m}-${day}`;
}
function frDate(iso){
  if(!iso) return "";
  const [y,m,d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/* ------------------------------------------------------------------ */
/* 3. ETAT DE LA SEANCE EN COURS (avant enregistrement)                 */
/* ------------------------------------------------------------------ */
let current = null; // objet séance en construction

function newCurrent(classe, apsa){
  const eleves = CLASSES[classe] || [];
  const presence = {};
  eleves.forEach(n => presence[n] = "present");
  return {
    id: uid(),
    date: document.getElementById("inp-date").value || todayISO(),
    classe, apsa,
    presence,
    implication_sociale: {},
    contenu: "",
    engagement: "moyen",
    comportement: "moyen",
    objectif: "partiel",
    // Évaluation rapide par élève, en 1 tap : "positif" | "negatif" | absent = neutre.
    travail: {},
    attitude: {},
    // Petit mot libre optionnel par élève pour cette séance.
    remarques: {}
  };
}

/* ------------------------------------------------------------------ */
/* 4. INITIALISATION DES SELECTS                                        */
/* ------------------------------------------------------------------ */
function fillClasseSelects(){
  const classNames = Object.keys(CLASSES).sort();
  const selSeance = document.getElementById("sel-classe");
  const selFiltre = document.getElementById("f-classe");
  const prevSeance = selSeance.value;
  const prevFiltre = selFiltre.value;

  selSeance.innerHTML = '<option value="">— Choisir une classe —</option>';
  selFiltre.innerHTML = '<option value="">Toutes</option>';
  classNames.forEach(c => {
    selSeance.appendChild(new Option(c, c));
    selFiltre.appendChild(new Option(c, c));
  });

  selSeance.value = classNames.includes(prevSeance) ? prevSeance : "";
  selFiltre.value = classNames.includes(prevFiltre) ? prevFiltre : "";
}

/* Appelé après tout ajout / suppression / renommage de classe ou élève :
   remet à jour tous les menus déroulants concernés de l'application. */
function refreshAfterClassesEdit(){
  fillClasseSelects();
  fillEleveFiltre();
  onClasseOrApsaChange(); // masque/rafraîchit la séance en cours si besoin
}
function fillApsaSelects(){
  const selSeance = document.getElementById("sel-apsa");
  const selFiltre = document.getElementById("f-apsa");
  const prevSeance = selSeance.value;
  const prevFiltre = selFiltre.value;

  const sorted = [...APSA_LIST].sort((a,b) => a.localeCompare(b, "fr"));

  selSeance.innerHTML = '<option value="">— Choisir une APSA —</option>';
  selFiltre.innerHTML = '<option value="">Toutes</option>';
  sorted.forEach(a => {
    selSeance.appendChild(new Option(a, a));
    selFiltre.appendChild(new Option(a, a));
  });

  selSeance.value = APSA_LIST.includes(prevSeance) ? prevSeance : "";
  selFiltre.value = APSA_LIST.includes(prevFiltre) ? prevFiltre : "";
}
function fillEleveFiltre(){
  const sel = document.getElementById("f-eleve");
  const prev = sel.value;
  sel.innerHTML = '<option value="">Tous</option>';
  const classe = document.getElementById("f-classe").value;
  let names = [];
  if(classe){ names = CLASSES[classe] || []; }
  else { names = Object.values(CLASSES).flat(); }
  names = [...new Set(names)].sort();
  names.forEach(n => sel.appendChild(new Option(n, n)));
  sel.value = names.includes(prev) ? prev : "";
}

document.getElementById("inp-date").value = todayISO();

/* ------------------------------------------------------------------ */
/* 4ter. GESTION DES APSA (édition simple, ajout/renommage/suppression) */
/* ------------------------------------------------------------------ */
const modalApsa = document.getElementById("modal-apsa-backdrop");

document.getElementById("btn-manage-apsa").addEventListener("click", () => {
  renderApsaAdmin();
  modalApsa.classList.add("is-visible");
});
document.getElementById("btn-apsa-done").addEventListener("click", () => {
  modalApsa.classList.remove("is-visible");
});
document.getElementById("btn-add-apsa").addEventListener("click", () => {
  const nom = prompt("Nom de la nouvelle APSA :");
  if(!nom || !nom.trim()) return;
  if(APSA_LIST.includes(nom.trim())){ alert("Cette APSA existe déjà."); return; }
  APSA_LIST.push(nom.trim());
  saveApsaData();
  renderApsaAdmin();
  fillApsaSelects();
});

function renderApsaAdmin(){
  APSA_LIST.sort((a,b) => a.localeCompare(b, "fr"));
  const ul = document.getElementById("apsa-admin-list");
  ul.innerHTML = "";
  if(APSA_LIST.length === 0){
    ul.innerHTML = '<li class="empty-hint">Aucune APSA pour le moment.</li>';
    return;
  }
  APSA_LIST.forEach((nom, idx) => {
    const li = document.createElement("li");
    const input = document.createElement("input");
    input.type = "text";
    input.value = nom;
    input.setAttribute("aria-label", "Nom de l'APSA");
    input.addEventListener("change", () => {
      const v = input.value.trim();
      if(!v){ input.value = nom; return; }
      if(APSA_LIST.includes(v) && v !== nom){ alert("Cette APSA existe déjà."); input.value = nom; return; }
      APSA_LIST[idx] = v;
      saveApsaData();
      fillApsaSelects();
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn-eleve-delete";
    del.textContent = "✕";
    del.title = "Supprimer cette APSA";
    del.addEventListener("click", () => {
      APSA_LIST.splice(idx, 1);
      saveApsaData();
      renderApsaAdmin();
      fillApsaSelects();
    });
    li.appendChild(input);
    li.appendChild(del);
    ul.appendChild(li);
  });
}

/* ------------------------------------------------------------------ */
/* 4quater. SAUVEGARDE COMPLETE (export/import JSON pour transférer     */
/* toutes les données — classes, APSA, séances, carnets — entre         */
/* plusieurs appareils, ex: PC et smartphone).                          */
/* ------------------------------------------------------------------ */
const BACKUP_VERSION = 1;

document.getElementById("btn-export-all").addEventListener("click", () => {
  const backup = {
    app: "carnet-eps",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    classes: CLASSES,
    apsa: APSA_LIST,
    seances: loadSeances(),
    carnet: loadCarnet()
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `carnet-eps-sauvegarde-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

/* Fusionne une sauvegarde importée avec les données déjà présentes sur CET
   appareil, sans rien écraser :
   - Classes/élèves/APSA : union (ajoute ce qui manque, dédoublonné).
   - Séances : ajoutées si leur identifiant unique n'existe pas déjà ici
     (chaque séance créée sur n'importe quel appareil a un id unique,
     donc deux séances différentes ne peuvent jamais entrer en conflit).
   - Carnet d'entraînement : complète les élèves sans texte local, mais ne
     remplace jamais un texte déjà saisi sur cet appareil (pas d'horodatage
     fiable pour arbitrer un conflit texte contre texte). */
function mergeImportedData(data){
  let addedClasses = 0, addedEleves = 0, addedApsa = 0, addedCarnet = 0, skippedCarnet = 0;

  Object.keys(data.classes || {}).forEach(classe => {
    if(!CLASSES[classe]){ CLASSES[classe] = []; addedClasses++; }
    (data.classes[classe] || []).forEach(nom => {
      if(!CLASSES[classe].includes(nom)){ CLASSES[classe].push(nom); addedEleves++; }
    });
  });
  saveClassesData();

  (data.apsa || []).forEach(a => {
    if(!APSA_LIST.includes(a)){ APSA_LIST.push(a); addedApsa++; }
  });
  saveApsaData();

  const existingSeances = loadSeances();
  const existingIds = new Set(existingSeances.map(s => s.id));
  let addedSeances = 0;
  (data.seances || []).forEach(s => {
    if(s && s.id && !existingIds.has(s.id)){
      existingSeances.push(s);
      existingIds.add(s.id);
      addedSeances++;
    }
  });
  saveSeances(existingSeances);

  const localCarnet = loadCarnet();
  Object.entries(data.carnet || {}).forEach(([nom, texte]) => {
    if(!texte || !texte.trim()) return;
    const local = localCarnet[nom];
    if(!local || !local.trim()){
      localCarnet[nom] = texte;
      addedCarnet++;
    } else if(local.trim() !== texte.trim()){
      skippedCarnet++; // conflit : on garde le texte local, on prévient l'utilisateur
    }
  });
  saveCarnet(localCarnet);

  return { addedClasses, addedEleves, addedApsa, addedSeances, addedCarnet, skippedCarnet };
}

document.getElementById("import-all-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result));
      if(!data || data.app !== "carnet-eps" || !data.classes || !data.seances){
        throw new Error("Format de sauvegarde non reconnu.");
      }
      const result = mergeImportedData(data);
      alert(
        `Import fusionné avec succès :\n` +
        `• ${result.addedSeances} nouvelle(s) séance(s) ajoutée(s)\n` +
        `• ${result.addedClasses} nouvelle(s) classe(s), ${result.addedEleves} nouvel(le)(s) élève(s)\n` +
        `• ${result.addedApsa} nouvelle(s) APSA\n` +
        `• ${result.addedCarnet} carnet(s) d'entraînement complété(s)\n\n` +
        (result.skippedCarnet > 0
          ? `⚠️ ${result.skippedCarnet} carnet(s) existaient déjà sur les deux appareils avec un texte différent : ` +
            `le texte de CET appareil a été conservé. Vérifiez-les si besoin.\n\n`
          : "") +
        `L'application va se recharger.`
      );
      location.reload();
    } catch(err){
      alert("Ce fichier n'a pas pu être lu comme une sauvegarde Carnet EPS valide.");
    }
  };
  reader.readAsText(file, "UTF-8");
  e.target.value = "";
});

/* ------------------------------------------------------------------ */
/* 4bis. GESTION DES CLASSES / ELEVES (édition + import/export CSV)     */
/* ------------------------------------------------------------------ */
const modalClasses = document.getElementById("modal-classes-backdrop");

document.getElementById("btn-manage-classes").addEventListener("click", () => {
  renderClassesAdmin();
  modalClasses.classList.add("is-visible");
});
document.getElementById("btn-classes-done").addEventListener("click", () => {
  modalClasses.classList.remove("is-visible");
});

function renderClassesAdmin(){
  const container = document.getElementById("classes-admin-list");
  container.innerHTML = "";
  const classNames = Object.keys(CLASSES).sort();

  if(classNames.length === 0){
    container.innerHTML = '<p class="empty-hint">Aucune classe pour le moment. Importez un CSV ou ajoutez une classe ci-dessous.</p>';
  }

  classNames.forEach(classe => {
    const card = document.createElement("div");
    card.className = "classe-admin-card";

    // -- en-tête : nom de la classe + suppression --
    const head = document.createElement("div");
    head.className = "classe-admin-card__head";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "classe-name-input";
    nameInput.value = classe;
    nameInput.setAttribute("aria-label", "Nom de la classe");
    nameInput.addEventListener("change", () => {
      const newName = nameInput.value.trim();
      if(!newName || newName === classe){ nameInput.value = classe; return; }
      if(CLASSES[newName]){ alert("Une classe porte déjà ce nom."); nameInput.value = classe; return; }
      CLASSES[newName] = CLASSES[classe];
      delete CLASSES[classe];
      saveClassesData();
      renderClassesAdmin();
      refreshAfterClassesEdit();
    });

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "btn-classe-delete";
    delBtn.textContent = "✕ Supprimer la classe";
    delBtn.addEventListener("click", () => {
      if(!confirm(`Supprimer la classe ${classe} et tous ses élèves de la liste ?\n(Les séances déjà enregistrées pour cette classe restent conservées dans l'historique.)`)) return;
      delete CLASSES[classe];
      saveClassesData();
      renderClassesAdmin();
      refreshAfterClassesEdit();
    });

    head.appendChild(nameInput);
    head.appendChild(delBtn);

    // -- liste des élèves --
    const ul = document.createElement("ul");
    ul.className = "eleve-admin-list";
    CLASSES[classe].forEach((nom, idx) => {
      const li = document.createElement("li");

      const input = document.createElement("input");
      input.type = "text";
      input.value = nom;
      input.setAttribute("aria-label", "Nom de l'élève");
      input.addEventListener("change", () => {
        const v = input.value.trim();
        if(!v){ input.value = nom; return; }
        CLASSES[classe][idx] = v;
        saveClassesData();
        refreshAfterClassesEdit();
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "btn-eleve-delete";
      del.textContent = "✕";
      del.title = "Supprimer cet élève";
      del.addEventListener("click", () => {
        CLASSES[classe].splice(idx, 1);
        saveClassesData();
        renderClassesAdmin();
        refreshAfterClassesEdit();
      });

      li.appendChild(input);
      li.appendChild(del);
      ul.appendChild(li);
    });

    // -- ajout d'un élève --
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "btn btn--ghost btn--sm";
    addBtn.textContent = "+ Ajouter un élève";
    addBtn.addEventListener("click", () => {
      const nom = prompt(`Nom du nouvel élève pour la classe ${classe} :`);
      if(!nom || !nom.trim()) return;
      CLASSES[classe].push(nom.trim());
      saveClassesData();
      renderClassesAdmin();
      refreshAfterClassesEdit();
    });

    card.appendChild(head);
    card.appendChild(ul);
    card.appendChild(addBtn);
    container.appendChild(card);
  });
}

document.getElementById("btn-add-classe").addEventListener("click", () => {
  const nom = prompt("Nom de la nouvelle classe (ex : 4C) :");
  if(!nom || !nom.trim()) return;
  const key = nom.trim();
  if(CLASSES[key]){ alert("Cette classe existe déjà."); return; }
  CLASSES[key] = [];
  saveClassesData();
  renderClassesAdmin();
  refreshAfterClassesEdit();
});

/* --- Export CSV (classe,eleve) --- */
document.getElementById("btn-csv-export").addEventListener("click", () => {
  const rows = ["classe,eleve"];
  Object.keys(CLASSES).sort().forEach(classe => {
    CLASSES[classe].forEach(nom => rows.push(`${csvField(classe)},${csvField(nom)}`));
  });
  const blob = new Blob(["\uFEFF" + rows.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "classes_eleves.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
function csvField(v){
  const s = String(v);
  return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/* --- Import CSV (classe,eleve) --- */
document.getElementById("csv-import-input").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const result = importClassesCsv(String(reader.result));
      renderClassesAdmin();
      refreshAfterClassesEdit();
      alert(`Import terminé : ${result.classes} nouvelle(s) classe(s), ${result.eleves} nouvel(le)(s) élève(s) ajouté(e)(s).`);
    } catch(err){
      alert("Le fichier CSV n'a pas pu être lu. Format attendu : deux colonnes \"classe,eleve\" (ou séparées par ;), une ligne par élève.");
    }
  };
  reader.readAsText(file, "UTF-8");
  e.target.value = ""; // permet de réimporter le même fichier plus tard
});

function importClassesCsv(text){
  const cleaned = text.replace(/^\uFEFF/, "");
  const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if(lines.length === 0) throw new Error("Fichier vide");
  const delimiter = lines[0].includes(";") && !lines[0].includes(",") ? ";" : ",";

  let addedClasses = 0, addedEleves = 0;
  lines.forEach((line, idx) => {
    const cols = parseCsvLine(line, delimiter);
    if(cols.length < 2) return;
    const classe = (cols[0] || "").trim();
    const eleve = (cols[1] || "").trim();
    if(idx === 0 && classe.toLowerCase().replace(/\s/g,"") === "classe") return; // ligne d'en-tête
    if(!classe || !eleve) return;
    if(!CLASSES[classe]){ CLASSES[classe] = []; addedClasses++; }
    if(!CLASSES[classe].includes(eleve)){ CLASSES[classe].push(eleve); addedEleves++; }
  });
  saveClassesData();
  return { classes: addedClasses, eleves: addedEleves };
}

function parseCsvLine(line, delimiter){
  const result = [];
  let cur = "", inQuotes = false;
  for(let i = 0; i < line.length; i++){
    const c = line[i];
    if(c === '"'){
      if(inQuotes && line[i+1] === '"'){ cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if(c === delimiter && !inQuotes){
      result.push(cur); cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result.map(s => s.trim());
}

/* ------------------------------------------------------------------ */
/* 5. NAVIGATION ENTRE LES 2 ECRANS                                     */
/* ------------------------------------------------------------------ */
function showScreen(id){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("is-visible"));
  document.getElementById(id).classList.add("is-visible");
  document.getElementById("nav-seance").classList.toggle("is-active", id === "ecran-seance");
  document.getElementById("nav-seance").setAttribute("aria-selected", id === "ecran-seance");
  document.getElementById("nav-bilans").classList.toggle("is-active", id === "ecran-bilans");
  document.getElementById("nav-bilans").setAttribute("aria-selected", id === "ecran-bilans");
  if(id === "ecran-bilans"){ refreshBilansEcran(); }
}
document.getElementById("nav-seance").addEventListener("click", () => showScreen("ecran-seance"));
document.getElementById("nav-bilans").addEventListener("click", () => showScreen("ecran-bilans"));
document.getElementById("btn-goto-bilans").addEventListener("click", () => showScreen("ecran-bilans"));

document.querySelectorAll(".subtabs__btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".subtabs__btn").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("is-visible"));
    document.getElementById(btn.dataset.panel).classList.add("is-visible");
  });
});

/* ------------------------------------------------------------------ */
/* 6. ECRAN 1 — construction de la séance                               */
/* ------------------------------------------------------------------ */
function onClasseOrApsaChange(){
  const classe = document.getElementById("sel-classe").value;
  const apsa = document.getElementById("sel-apsa").value;
  const body = document.getElementById("seance-body");
  if(!classe || !apsa){
    body.classList.add("hidden");
    current = null;
    return;
  }
  current = newCurrent(classe, apsa);
  body.classList.remove("hidden");
  renderEleves();
  renderCarnetSelect();
  document.getElementById("zone-libre").value = "";
  document.getElementById("save-flash").textContent = "";
}
document.getElementById("sel-classe").addEventListener("change", onClasseOrApsaChange);
document.getElementById("sel-apsa").addEventListener("change", onClasseOrApsaChange);
document.getElementById("inp-date").addEventListener("change", () => {
  if(current) current.date = document.getElementById("inp-date").value;
});

function renderEleves(){
  const list = document.getElementById("eleves-list");
  list.innerHTML = "";
  const eleves = CLASSES[current.classe] || [];
  document.getElementById("eleves-count").textContent = `(${eleves.length})`;

  eleves.forEach(nom => {
    const li = document.createElement("li");
    li.className = "eleve-row";
    const etat = current.presence[nom] || "present";

    // -- ligne du haut : nom + présence --
    const top = document.createElement("div");
    top.className = "eleve-row__top";

    const nameSpan = document.createElement("span");
    nameSpan.className = "eleve-row__name";
    nameSpan.textContent = nom;

    const pillGroup = document.createElement("div");
    pillGroup.className = "pill-group";
    ["present","absent","dispense"].forEach(key => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `pill pill--${key}` + (etat === key ? " is-active" : "");
      b.textContent = PRESENCE_LABELS[key];
      b.addEventListener("click", () => {
        current.presence[nom] = key;
        if(key !== "dispense") delete current.implication_sociale[nom];
        renderEleves();
      });
      pillGroup.appendChild(b);
    });

    top.appendChild(nameSpan);
    top.appendChild(pillGroup);
    li.appendChild(top);

    // -- ligne d'évaluation rapide : Travail / Attitude / Remarque -- 
    // Masquée pour les absents (rien à évaluer).
    if(etat !== "absent"){
      const evalRow = document.createElement("div");
      evalRow.className = "eleve-row__eval";
      evalRow.appendChild(buildEvalGroup(nom, "travail", "Travail"));
      evalRow.appendChild(buildEvalGroup(nom, "attitude", "Attitude"));

      const remarqueInput = document.createElement("input");
      remarqueInput.type = "text";
      remarqueInput.className = "remarque-input";
      remarqueInput.placeholder = "Remarque (optionnel)";
      remarqueInput.value = current.remarques[nom] || "";
      remarqueInput.setAttribute("aria-label", `Remarque pour ${nom}`);
      remarqueInput.addEventListener("input", () => {
        current.remarques[nom] = remarqueInput.value;
      });
      evalRow.appendChild(remarqueInput);

      li.appendChild(evalRow);
    }

    if(etat === "dispense"){
      const wrap = document.createElement("label");
      wrap.className = "eleve-row__social";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!current.implication_sociale[nom];
      cb.addEventListener("change", () => { current.implication_sociale[nom] = cb.checked; });
      wrap.appendChild(cb);
      wrap.appendChild(document.createTextNode("Implication sociale"));
      li.appendChild(wrap);
    }

    list.appendChild(li);
  });
}

/* Construit un petit groupe "Label : 👍 👎" pour un axe (travail/attitude).
   1 tap = actif (surbrillance) ; re-tap = retour au neutre (aucune trace). */
function buildEvalGroup(nom, axis, label){
  const group = document.createElement("div");
  group.className = "eval-group";

  const labelSpan = document.createElement("span");
  labelSpan.className = "eval-group__label";
  labelSpan.textContent = label;
  group.appendChild(labelSpan);

  ["positif", "negatif"].forEach(val => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.val = val;
    btn.className = `eval-btn eval-btn--${val}` + (current[axis][nom] === val ? " is-active" : "");
    btn.textContent = val === "positif" ? "👍" : "👎";
    btn.setAttribute("aria-label", `${label} ${val === "positif" ? "positif" : "à travailler"} pour ${nom}`);
    btn.addEventListener("click", () => {
      if(current[axis][nom] === val){
        delete current[axis][nom]; // re-tap : retour au neutre
      } else {
        current[axis][nom] = val;
      }
      group.querySelectorAll(".eval-btn").forEach(b => {
        b.classList.toggle("is-active", b.dataset.val === current[axis][nom]);
      });
    });
    group.appendChild(btn);
  });

  return group;
}

function renderCarnetSelect(){
  const sel = document.getElementById("sel-carnet-eleve");
  sel.innerHTML = "";
  (CLASSES[current.classe] || []).forEach(n => sel.appendChild(new Option(n, n)));
  const fillTextarea = () => {
    const carnet = loadCarnet();
    const key = carnetKey(current.classe, current.apsa, sel.value);
    // Repli : si rien n'existe encore pour ce cycle précis, on affiche
    // l'ancienne saisie "1 texte par élève" (versions antérieures de l'app),
    // pour ne rien perdre lors d'une réimportation d'une ancienne sauvegarde.
    const valeur = carnet[key] !== undefined ? carnet[key] : (carnet[sel.value] || "");
    document.getElementById("carnet-texte").value = valeur;
  };
  fillTextarea();
  sel.onchange = fillTextarea;
  document.getElementById("carnet-texte").oninput = () => {
    const c = loadCarnet();
    const key = carnetKey(current.classe, current.apsa, sel.value);
    c[key] = document.getElementById("carnet-texte").value;
    saveCarnet(c);
  };
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/* Résume un axe (travail ou attitude) d'une séance : qui a été noté 👍, qui a été noté 👎. */
function summarizeAxis(axisData){
  const pos = [], neg = [];
  Object.entries(axisData || {}).forEach(([nom, val]) => {
    if(val === "positif") pos.push(nom);
    else if(val === "negatif") neg.push(nom);
  });
  return { pos, neg };
}
function summarizeAxisHtml(axisData){
  const { pos, neg } = summarizeAxis(axisData);
  return `👍 (${pos.length}) : ${pos.map(escapeHtml).join(", ") || "—"}<br>👎 (${neg.length}) : ${neg.map(escapeHtml).join(", ") || "—"}`;
}
function summarizeAxisPlain(axisData){
  const { pos, neg } = summarizeAxis(axisData);
  return `Positif : ${pos.join(", ") || "aucun"}  |  À travailler : ${neg.join(", ") || "aucun"}`;
}

/* --- Enregistrement de la séance --- */
document.getElementById("btn-save").addEventListener("click", () => {
  if(!current){ return; }
  current.date = document.getElementById("inp-date").value || todayISO();
  current.contenu = document.getElementById("zone-libre").value;
  current.engagement = document.getElementById("sel-engagement").value;
  current.comportement = document.getElementById("sel-comportement").value;
  current.objectif = document.getElementById("sel-objectif").value;

  const list = loadSeances();
  list.push(JSON.parse(JSON.stringify(current)));
  saveSeances(list);

  const flash = document.getElementById("save-flash");
  flash.textContent = "✓ Séance enregistrée le " + frDate(current.date) + " pour " + current.classe;
  setTimeout(() => { flash.textContent = ""; }, 4000);

  // Réinitialise une nouvelle séance vierge pour la même classe/APSA
  current = newCurrent(current.classe, current.apsa);
  renderEleves();
  document.getElementById("zone-libre").value = "";
});

/* ------------------------------------------------------------------ */
/* 7. ECRAN 2 — FILTRES                                                  */
/* ------------------------------------------------------------------ */
["f-classe","f-apsa","f-eleve","f-date-debut","f-date-fin"].forEach(id => {
  document.getElementById(id).addEventListener("change", refreshBilansEcran);
});
document.getElementById("f-classe").addEventListener("change", fillEleveFiltre);

function getFilteredSeances(){
  const classe = document.getElementById("f-classe").value;
  const apsa = document.getElementById("f-apsa").value;
  const eleve = document.getElementById("f-eleve").value;
  const debut = document.getElementById("f-date-debut").value;
  const fin = document.getElementById("f-date-fin").value;

  return loadSeances().filter(s => {
    if(classe && s.classe !== classe) return false;
    if(apsa && s.apsa !== apsa) return false;
    if(debut && s.date < debut) return false;
    if(fin && s.date > fin) return false;
    if(eleve){
      const inClasse = (CLASSES[s.classe] || []).includes(eleve);
      if(!inClasse) return false;
    }
    return true;
  }).sort((a,b) => b.date.localeCompare(a.date));
}

function refreshBilansEcran(){
  renderHistorique();
  renderBilanIndividuel();
  renderBilanClasse();
  renderBilanProjet();
}

/* --- 7.1 Historique --- */
function renderHistorique(){
  const seances = getFilteredSeances();
  const box = document.getElementById("historique-list");
  box.innerHTML = "";
  if(seances.length === 0){
    box.innerHTML = '<p class="empty-hint">Aucune séance ne correspond à ces filtres.</p>';
    return;
  }
  seances.forEach(s => {
    const presentCount = Object.values(s.presence).filter(v => v === "present").length;
    const absentCount = Object.values(s.presence).filter(v => v === "absent").length;
    const dispenseCount = Object.values(s.presence).filter(v => v === "dispense").length;
    const travailNeg = summarizeAxis(s.travail).neg.length;
    const attitudeNeg = summarizeAxis(s.attitude).neg.length;
    const nbRemarques = Object.values(s.remarques || {}).filter(t => t && t.trim()).length;

    const card = document.createElement("div");
    card.className = "seance-card";
    card.innerHTML = `
      <div class="seance-card__top">
        <span class="seance-card__date">${frDate(s.date)} — ${escapeHtml(s.classe)}</span>
        <span class="seance-card__meta">${escapeHtml(s.apsa)}</span>
      </div>
      <div class="seance-card__excerpt">${escapeHtml((s.contenu || "").slice(0,140))}${(s.contenu||"").length>140 ? "…" : ""}</div>
      <div class="seance-card__badges">
        <span class="badge">${presentCount} présent(s)</span>
        <span class="badge">${absentCount} absent(s)</span>
        <span class="badge">${dispenseCount} dispensé(s)</span>
        <span class="badge">Engagement : ${s.engagement}</span>
        <span class="badge">Comportement : ${s.comportement}</span>
        ${travailNeg > 0 ? `<span class="badge">⚠️ Travail : ${travailNeg}</span>` : ""}
        ${attitudeNeg > 0 ? `<span class="badge">⚠️ Attitude : ${attitudeNeg}</span>` : ""}
        ${nbRemarques > 0 ? `<span class="badge">${nbRemarques} remarque(s)</span>` : ""}
      </div>
    `;
    card.addEventListener("click", () => openSeanceModal(s.id));
    box.appendChild(card);
  });
}

/* --- Modal detail seance + suppression + export PDF --- */
const modalSeance = document.getElementById("modal-seance-backdrop");
let modalSeanceId = null;

function openSeanceModal(id){
  const s = loadSeances().find(x => x.id === id);
  if(!s) return;
  modalSeanceId = id;
  document.getElementById("modal-seance-content").innerHTML = buildSeanceDetailHtml(s);
  modalSeance.classList.add("is-visible");
}
document.getElementById("btn-seance-close").addEventListener("click", () => modalSeance.classList.remove("is-visible"));
document.getElementById("btn-seance-delete").addEventListener("click", () => {
  if(!modalSeanceId) return;
  if(!confirm("Supprimer définitivement cette séance ?")) return;
  const list = loadSeances().filter(s => s.id !== modalSeanceId);
  saveSeances(list);
  modalSeance.classList.remove("is-visible");
  refreshBilansEcran();
});
document.getElementById("btn-seance-pdf").addEventListener("click", () => {
  if(!modalSeanceId) return;
  const s = loadSeances().find(x => x.id === modalSeanceId);
  if(s) exportSeancePdf(s);
});

function buildSeanceDetailHtml(s){
  const presentsList = groupPresence(s);
  const remarquesHtml = Object.entries(s.remarques || {})
    .filter(([, txt]) => txt && txt.trim())
    .map(([nom, txt]) => `<li><b>${escapeHtml(nom)}</b> — ${escapeHtml(txt)}</li>`)
    .join("") || "<li>Aucune</li>";
  return `
    <dl>
      <dt>Date</dt><dd>${frDate(s.date)}</dd>
      <dt>Classe</dt><dd>${escapeHtml(s.classe)}</dd>
      <dt>APSA</dt><dd>${escapeHtml(s.apsa)}</dd>
      <dt>Présence</dt><dd>${presentsList}</dd>
      <dt>Contenu réel</dt><dd>${escapeHtml(s.contenu || "—")}</dd>
      <dt>Critères globaux</dt><dd>Engagement : ${s.engagement} · Comportement : ${s.comportement} · Objectif atteint : ${s.objectif}</dd>
      <dt>Travail (par élève)</dt><dd>${summarizeAxisHtml(s.travail)}</dd>
      <dt>Attitude (par élève)</dt><dd>${summarizeAxisHtml(s.attitude)}</dd>
      <dt>Remarques</dt><dd><ul>${remarquesHtml}</ul></dd>
    </dl>
  `;
}
function groupPresence(s){
  const present = [], absent = [], dispense = [];
  Object.entries(s.presence).forEach(([n,v]) => {
    if(v==="present") present.push(n);
    else if(v==="absent") absent.push(n);
    else if(v==="dispense") dispense.push(n + (s.implication_sociale[n] ? " (implication sociale)" : ""));
  });
  return `Présents (${present.length}) : ${present.join(", ") || "—"}<br>`+
         `Absents (${absent.length}) : ${absent.join(", ") || "—"}<br>`+
         `Dispensés (${dispense.length}) : ${dispense.join(", ") || "—"}`;
}

/* ------------------------------------------------------------------ */
/* 8. BILANS AUTOMATIQUES                                                */
/* ------------------------------------------------------------------ */
function renderBilanIndividuel(){
  const box = document.getElementById("bilan-individuel-box");
  const eleve = document.getElementById("f-eleve").value;
  if(!eleve){
    box.innerHTML = '<p class="empty-hint">Choisissez un élève dans les filtres ci-dessus pour générer son bilan.</p>';
    return;
  }
  const seances = getFilteredSeances().filter(s => (s.presence[eleve] !== undefined));
  if(seances.length === 0){
    box.innerHTML = `<p class="empty-hint">Aucune séance trouvée pour ${escapeHtml(eleve)} avec ces filtres.</p>`;
    return;
  }
  const total = seances.length;
  const present = seances.filter(s => s.presence[eleve] === "present").length;
  const absent = seances.filter(s => s.presence[eleve] === "absent").length;
  const dispense = seances.filter(s => s.presence[eleve] === "dispense").length;
  const implication = seances.filter(s => s.implication_sociale[eleve]).length;

  // Tags rapides Travail / Attitude, comptés séance par séance pour cet élève.
  let travailPos = 0, travailNeg = 0, attitudePos = 0, attitudeNeg = 0;
  const remarquesList = [];
  seances.forEach(s => {
    const tv = (s.travail || {})[eleve];
    if(tv === "positif") travailPos++; else if(tv === "negatif") travailNeg++;
    const at = (s.attitude || {})[eleve];
    if(at === "positif") attitudePos++; else if(at === "negatif") attitudeNeg++;
    const rem = (s.remarques || {})[eleve];
    if(rem && rem.trim()) remarquesList.push({ date: s.date, texte: rem.trim() });
  });

  const carnetData = loadCarnet();
  const cyclesRencontres = [...new Set(seances.map(s => `${s.classe}||${s.apsa}`))];
  const carnetEntries = cyclesRencontres
    .map(key => {
      const [classe, apsa] = key.split("||");
      return { classe, apsa, texte: carnetData[carnetKey(classe, apsa, eleve)] };
    })
    .filter(c => c.texte && c.texte.trim());

  // Repli : si aucune évaluation par cycle n'existe encore mais qu'une
  // ancienne saisie "1 texte par élève" a été réimportée, on l'affiche
  // quand même, distinguée comme non rattachée à un cycle précis.
  if(carnetEntries.length === 0 && carnetData[eleve] && carnetData[eleve].trim()){
    carnetEntries.push({ classe: null, apsa: "Ancienne saisie (cycle non précisé)", texte: carnetData[eleve] });
  }

  let txtAssiduite = `${eleve} a été présent(e) à ${present} séance(s) sur ${total} (${pct(present,total)}%), absent(e) à ${absent} séance(s)`+
    (dispense ? `, et dispensé(e) présent(e) à ${dispense} séance(s)` : "") + ".";

  // Principe : l'absence de tag négatif est considérée comme correcte par
  // défaut. Seuls les écarts (positifs ou négatifs) explicitement notés
  // pendant les séances alimentent ce texte.
  let txtTravail = (travailPos === 0 && travailNeg === 0)
    ? `Aucun écart n'a été relevé sur l'investissement dans le travail : l'attitude face aux tâches proposées a été correcte sur l'ensemble de la période.`
    : travailNeg === 0
    ? `L'investissement dans le travail a été noté positivement à ${travailPos} reprise(s), sans écart relevé.`
    : travailPos >= travailNeg
    ? `L'investissement est globalement positif (${travailPos} fois noté) malgré ${travailNeg} écart(s) relevé(s).`
    : `Des écarts d'investissement dans le travail ont été relevés à ${travailNeg} reprise(s), contre ${travailPos} moment(s) positif(s) noté(s).`;

  let txtAttitude = (attitudePos === 0 && attitudeNeg === 0)
    ? `Aucun écart n'a été relevé sur l'attitude envers les autres : le comportement a été correct sur l'ensemble de la période.`
    : attitudeNeg === 0
    ? `L'attitude envers les autres a été notée positivement à ${attitudePos} reprise(s), sans écart relevé.`
    : attitudePos >= attitudeNeg
    ? `L'attitude envers les autres est globalement positive (${attitudePos} fois notée) malgré ${attitudeNeg} écart(s) relevé(s).`
    : `Des écarts d'attitude envers les autres ont été relevés à ${attitudeNeg} reprise(s), contre ${attitudePos} moment(s) positif(s) noté(s).`;

  let txtImplication = implication > 0
    ? `L'élève s'est montré(e) impliqué(e) socialement à ${implication} reprise(s) lors de dispenses (arbitrage, aide, organisation...).`
    : `Aucune implication sociale particulière n'a été relevée sur la période lors des dispenses.`;

  let txtCarnet = carnetEntries.length
    ? carnetEntries.map(c => c.classe
        ? `<strong>${escapeHtml(c.apsa)}</strong> (${escapeHtml(c.classe)}) : ${escapeHtml(c.texte.trim())}`
        : `<strong>${escapeHtml(c.apsa)}</strong> : ${escapeHtml(c.texte.trim())}`
      ).join("<br>")
    : `Aucune évaluation du carnet d'entraînement n'a été saisie pour cet élève sur cette période.`;

  let txtRemarques = remarquesList.length
    ? remarquesList.map(r => `• ${frDate(r.date)} — ${escapeHtml(r.texte)}`).join("<br>")
    : "Aucune remarque libre enregistrée sur la période.";

  box.innerHTML = `
    <h3>Bilan individuel — ${escapeHtml(eleve)}</h3>
    <div class="bilan-stats">
      <div class="stat"><span class="stat__num">${total}</span><span class="stat__label">Séances</span></div>
      <div class="stat"><span class="stat__num">${pct(present,total)}%</span><span class="stat__label">Présence</span></div>
      <div class="stat"><span class="stat__num">${travailPos}/${travailNeg}</span><span class="stat__label">Travail +/-</span></div>
      <div class="stat"><span class="stat__num">${attitudePos}/${attitudeNeg}</span><span class="stat__label">Attitude +/-</span></div>
    </div>
    <p>${txtAssiduite}</p>
    <p>${txtTravail}</p>
    <p>${txtAttitude}</p>
    <p>${txtImplication}</p>
    <h3>Carnet d'entraînement</h3>
    <p>${txtCarnet}</p>
    <h3>Remarques</h3>
    <p>${txtRemarques}</p>
  `;
}

function renderBilanClasse(){
  const box = document.getElementById("bilan-classe-box");
  const classe = document.getElementById("f-classe").value;
  if(!classe){
    box.innerHTML = '<p class="empty-hint">Choisissez une classe dans les filtres ci-dessus pour générer le bilan de classe.</p>';
    return;
  }
  const seances = getFilteredSeances().filter(s => s.classe === classe);
  if(seances.length === 0){
    box.innerHTML = `<p class="empty-hint">Aucune séance trouvée pour ${escapeHtml(classe)} avec ces filtres.</p>`;
    return;
  }
  const total = seances.length;
  let presentTot=0, absentTot=0, dispenseTot=0, implicationTot=0, elevesTot=0;
  seances.forEach(s => {
    const vals = Object.values(s.presence);
    elevesTot += vals.length;
    presentTot += vals.filter(v=>v==="present").length;
    absentTot += vals.filter(v=>v==="absent").length;
    dispenseTot += vals.filter(v=>v==="dispense").length;
    implicationTot += Object.values(s.implication_sociale).filter(Boolean).length;
  });
  const engagementScore = scoreFromList(seances.map(s=>s.engagement), {faible:0, moyen:1, bon:2});
  const comportementScore = scoreFromList(seances.map(s=>s.comportement), {ras:2, moyen:1, difficile:0});
  const objectifScore = scoreFromList(seances.map(s=>s.objectif), {non:0, partiel:1, oui:2});

  let travailPosTot = 0, travailNegTot = 0, attitudePosTot = 0, attitudeNegTot = 0;
  seances.forEach(s => {
    Object.values(s.travail || {}).forEach(v => { if(v==="positif") travailPosTot++; else if(v==="negatif") travailNegTot++; });
    Object.values(s.attitude || {}).forEach(v => { if(v==="positif") attitudePosTot++; else if(v==="negatif") attitudeNegTot++; });
  });

  const dyn = engagementScore >= 1.4
    ? "Le groupe montre une dynamique collective positive, la majorité des élèves s'engage volontiers dans les tâches proposées."
    : engagementScore >= 0.8
    ? "La dynamique de groupe est correcte mais irrégulière selon les séances et les contenus proposés."
    : "La dynamique de groupe reste fragile, avec un engagement collectif limité sur la période.";

  const respect = comportementScore >= 1.4
    ? "Le respect des règles est globalement acquis, les rappels au cadre restent ponctuels."
    : comportementScore >= 0.8
    ? "Le respect des règles est en cours d'acquisition, avec des écarts qui restent gérables."
    : "Le respect des règles a nécessité des interventions régulières sur la période.";

  const autonomie = (attitudePosTot >= attitudeNegTot)
    ? "Le nombre de tags d'attitude positive relevés est supérieur ou égal à celui des écarts, ce qui traduit une autonomie en progrès."
    : "Le nombre d'écarts d'attitude relevés dépasse celui des tags positifs ; l'autonomie du groupe est encore à construire.";

  const progressionCycle = objectifScore >= 1.4
    ? "Les objectifs de séance sont majoritairement atteints, la progression du cycle suit le rythme prévu."
    : objectifScore >= 0.8
    ? "Les objectifs sont partiellement atteints en moyenne, la progression du cycle est correcte mais peut être consolidée."
    : "Les objectifs de séance sont rarement pleinement atteints, la progression du cycle est à ajuster.";

  const implicationTxt = implicationTot > 0
    ? `${implicationTot} cas d'implication sociale ont été recensés parmi les élèves dispensés sur la période.`
    : "Aucune implication sociale particulière n'a été recensée parmi les élèves dispensés sur la période.";

  box.innerHTML = `
    <h3>Bilan de classe — ${escapeHtml(classe)}</h3>
    <div class="bilan-stats">
      <div class="stat"><span class="stat__num">${total}</span><span class="stat__label">Séances</span></div>
      <div class="stat"><span class="stat__num">${pct(presentTot, elevesTot)}%</span><span class="stat__label">Présence moy.</span></div>
      <div class="stat"><span class="stat__num">${dispenseTot}</span><span class="stat__label">Dispenses</span></div>
      <div class="stat"><span class="stat__num">${attitudePosTot}/${attitudeNegTot}</span><span class="stat__label">Attitude +/-</span></div>
    </div>
    <p>${dyn}</p>
    <p>${respect}</p>
    <p>${autonomie}</p>
    <p>${progressionCycle}</p>
    <p>${implicationTxt}</p>
  `;
}

function renderBilanProjet(){
  const box = document.getElementById("bilan-projet-box");
  const classe = document.getElementById("f-classe").value;
  if(!classe){
    box.innerHTML = '<p class="empty-hint">Choisissez une classe dans les filtres ci-dessus pour générer le projet de classe.</p>';
    return;
  }
  const seances = getFilteredSeances().filter(s => s.classe === classe);
  if(seances.length === 0){
    box.innerHTML = `<p class="empty-hint">Aucune séance trouvée pour ${escapeHtml(classe)} avec ces filtres.</p>`;
    return;
  }
  const comportementScore = scoreFromList(seances.map(s=>s.comportement), {ras:2, moyen:1, difficile:0});
  const objectifScore = scoreFromList(seances.map(s=>s.objectif), {non:0, partiel:1, oui:2});

  let implicationTot = 0;
  seances.forEach(s => { implicationTot += Object.values(s.implication_sociale || {}).filter(Boolean).length; });
  const apsaSet = [...new Set(seances.map(s=>s.apsa))];

  const attitude = comportementScore >= 1.4
    ? "L'attitude générale du groupe face aux apprentissages est positive et coopérative."
    : comportementScore >= 0.8
    ? "L'attitude générale du groupe est correcte, avec une marge de progression sur l'écoute et la coopération."
    : "L'attitude générale du groupe nécessite un travail continu sur le climat de classe et la coopération.";

  const roles = implicationTot > 0
    ? `${implicationTot} cas d'implication sociale ont été recensés parmi les élèves dispensés sur la période, ce qui montre une appropriation progressive des rôles sociaux du programme.`
    : "Peu d'implication sociale a été recensée jusqu'ici parmi les élèves dispensés ; le développement des rôles sociaux (arbitrage, observation, coaching) est un axe de travail pour la suite du projet de classe.";

  const progMotrice = `Le cycle a couvert ${apsaSet.length} APSA (${apsaSet.join(", ")}). La progression motrice est à objectiver séance après séance à partir des critères d'objectif atteint (moyenne actuelle : ${objectifScore.toFixed(1)}/2).`;

  const progMethodo = objectifScore >= 1.2
    ? "La progression méthodologique (analyse de sa pratique, verbalisation, utilisation du carnet d'entraînement) est en bonne voie."
    : "La progression méthodologique reste à renforcer, notamment l'usage du carnet d'entraînement et la verbalisation des ressentis.";

  const cohesion = comportementScore >= 1.2
    ? "La cohésion du groupe progresse, favorisée par les situations collectives et les rôles sociaux endossés."
    : "La cohésion du groupe est encore fragile ; multiplier les situations coopératives pourrait la renforcer.";

  box.innerHTML = `
    <h3>Projet de classe — ${escapeHtml(classe)}</h3>
    <p>${attitude}</p>
    <p>${roles}</p>
    <p>${progMotrice}</p>
    <p>${progMethodo}</p>
    <p>${cohesion}</p>
  `;
}

function scoreFromList(arr, mapping){
  if(arr.length === 0) return 0;
  const sum = arr.reduce((acc,v) => acc + (mapping[v] ?? 0), 0);
  return sum / arr.length;
}
function pct(a,b){ return b ? Math.round((a/b)*100) : 0; }

/* ------------------------------------------------------------------ */
/* 9. EXPORT PDF (jsPDF)                                                 */
/* ------------------------------------------------------------------ */
function exportSeancePdf(s){
  if(!window.jspdf){
    alert("La bibliothèque PDF n'est pas disponible hors-ligne pour le moment. Ouvrez l'application une fois en ligne pour la mettre en cache.");
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 16;
  let y = 20;
  const lineH = 6;
  const pageW = 210;
  const maxW = pageW - marginX*2;

  function h1(text){
    doc.setFont("helvetica","bold"); doc.setFontSize(16);
    doc.text(text, marginX, y); y += 9;
  }
  function h2(text){
    checkPage();
    doc.setFont("helvetica","bold"); doc.setFontSize(11.5);
    doc.text(text, marginX, y); y += 6;
  }
  function p(text){
    doc.setFont("helvetica","normal"); doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(String(text || "—"), maxW);
    lines.forEach(line => {
      checkPage();
      doc.text(line, marginX, y);
      y += lineH;
    });
    y += 2;
  }
  function checkPage(){
    if(y > 280){ doc.addPage(); y = 20; }
  }

  h1("Bilan de séance EPS");
  doc.setDrawColor(255,107,53); doc.setLineWidth(0.8);
  doc.line(marginX, y-4, pageW-marginX, y-4);

  h2("Informations générales");
  p(`Date : ${frDate(s.date)}    Classe : ${s.classe}    APSA : ${s.apsa}`);

  const present = [], absent = [], dispense = [];
  Object.entries(s.presence).forEach(([n,v]) => {
    if(v==="present") present.push(n);
    else if(v==="absent") absent.push(n);
    else if(v==="dispense") dispense.push(n + (s.implication_sociale[n] ? " (implication sociale)" : ""));
  });

  h2(`Présents (${present.length})`);
  p(present.join(", ") || "Aucun");
  h2(`Absents (${absent.length})`);
  p(absent.join(", ") || "Aucun");
  h2(`Dispensés présents (${dispense.length})`);
  p(dispense.join(", ") || "Aucun");

  h2("Contenu réel de la séance");
  p(s.contenu);

  h2("Critères globaux");
  p(`Engagement global : ${s.engagement}    Comportement global : ${s.comportement}    Objectif atteint : ${s.objectif}`);

  h2("Travail (par élève)");
  p(summarizeAxisPlain(s.travail));

  h2("Attitude (par élève)");
  p(summarizeAxisPlain(s.attitude));

  h2("Remarques");
  const remarqueEntries = Object.entries(s.remarques || {}).filter(([, t]) => t && t.trim());
  if(remarqueEntries.length === 0){
    p("Aucune remarque.");
  } else {
    remarqueEntries.forEach(([nom, txt]) => p(`• ${nom} — ${txt}`));
  }

  const filename = `bilan_${s.classe}_${s.date}.pdf`.replace(/\s+/g,"_");
  doc.save(filename);
}

/* ------------------------------------------------------------------ */
/* 10. INITIALISATION                                                    */
/* ------------------------------------------------------------------ */
fillClasseSelects();
fillApsaSelects();
fillEleveFiltre();

/* Enregistrement du service worker (PWA hors-ligne) */
if("serviceWorker" in navigator){
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {
      /* silencieux : l'app fonctionne aussi sans SW */
    });
  });
}

})();
