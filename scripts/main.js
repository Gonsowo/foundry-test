// NAVIGATION RULES MODULE (Foundry V13)
// Instala un botón en el Token Control junto a Token/Measure.
// Usa flags para almacenar usos diarios por actor.
// Define un FormApplication con reglas: Orientar, Forrajeo, Mantener el Ánimo, Ayuda.
// Incluye botón de reset diario para GM.
// Versión mínima de Foundry: v13.

const MODULE_ID = "navigation‑rules";

// Estructura de reglas definidas:
const RULES = {
  Orientar: {
    label: "Orientar",
    max: 1,
    ability: "wis",
    skill: "survival",
    dc: 15,
    onSuccess: async (roll, actor) => {
      ChatMessage.create({
        flavor: `<strong>${actor.name}</strong> orientó con éxito (DC ${this.dc}). El grupo puede elegir Acelerar o ir a Paso Lento.`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    },
    onFailure: async (roll, actor) => {
      ChatMessage.create({
        content: `${actor.name} no logra orientarse (total: ${roll.total}).`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    }
  },
  ForrajeoRaciones: {
    label: "Forrajeo (Raciones)",
    max: 2,
    ability: "wis",
    skill: "survival",
    dc: 10,
    onSuccess: async (roll, actor) => {
      const r = new Roll("1d6+2").roll({ async: false }).total;
      const raciones = Math.ceil(r / 2);
      ChatMessage.create({
        flavor: `${actor.name} encuentra ${raciones} raciones (rol: ${r}).`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    },
    onFailure: async (roll, actor) => {
      ChatMessage.create({
        content: `${actor.name} no encuentra nada útil (total: ${roll.total}).`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    }
  },
  ForrajeoCondimentos: {
    label: "Forrajeo (Condimentos)",
    max: 1,
    ability: "int",
    skill: "nature",
    dc: 10,
    onSuccess: async (roll, actor) => {
      const r = new Roll("1d4").roll({ async: false }).total;
      ChatMessage.create({
        flavor: `${actor.name} recoge ${r} condimentos.`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    },
    onFailure: async (roll, actor) => {
      ChatMessage.create({
        content: `${actor.name} no encuentra condimentos.`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    }
  },
  ForrajeoAgua: {
    label: "Forrajeo (Agua)",
    max: 2,
    ability: "wis",
    skill: "survival",
    dc: 10,
    onSuccess: async (roll, actor) => {
      const r = new Roll("2d4").roll({ async: false }).total;
      ChatMessage.create({
        flavor: `${actor.name} encuentra ${r} galones de agua.`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    },
    onFailure: async (roll, actor) => {
      ChatMessage.create({
        content: `${actor.name} no consigue agua.`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    }
  },
  MantenerAnimo: {
    label: "Mantener el Ánimo",
    max: 1,
    ability: "cha",
    skill: "persuasion",
    dc: 20,
    onSuccess: async (roll, actor) => {
      ChatMessage.create({
        flavor: `${actor.name} motiva al grupo con éxito (DC ${this.dc}). +2 a todas las acciones de navegación.`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    },
    onFailure: async (roll, actor) => {
      ChatMessage.create({
        content: `${actor.name} no logra animar al grupo.`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    }
  },
  Ayuda: {
    label: "Ayuda",
    max: 5,
    ability: null,
    skill: null,
    dc: null,
    onUse: async (actor) => {
      ChatMessage.create({
        flavor: `${actor.name} da ayuda a otro personaje: +1 a Acción de Navegación (+2 si tiene competencia).`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    }
  }
};

/**
 * Devuelve la fecha ISO en YYYY‑MM‑DD (local).
 */
function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Carga usos actuales desde flags; devuelve objeto { [rule]: { hoy, usado } }
 */
async function loadActorUsos(actor) {
  const raw = actor.getFlag(MODULE_ID, "usos") || {};
  const hoy = getTodayString();
  const usos = {};
  for (const [key, rule] of Object.entries(RULES)) {
    const inst = raw[key] || { hoy, usado: 0 };
    if (inst.hoy !== hoy) inst.usado = 0;
    usos[key] = inst;
  }
  return usos;
}

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Inicializando Navigation Rules módulo`);

  game.settings.register(MODULE_ID, "showNavigationButton", {
    name: "Mostrar botón de navegación",
    hint: "Agregar un botón a la barra de escena para abrir la interfaz.",
    default: true,
    config: true,
    type: Boolean,
    scope: "world"
  });

  window.NavigationForm = NavigationForm;
});

Hooks.on("ready", () => {
  // Nada adicional necesario aquí, ya que usamos getSceneControlButtons
});

Hooks.on("getSceneControlButtons", (controls) => {
  const group = controls.token;
  if (!group?.tools) return;

  if (!game.settings.get(MODULE_ID, "showNavigationButton")) return;

  group.tools.push({
    name: "navegacion",
    title: "Navegación",
    icon: "fas fa-compass",
    button: true,
    onClick: () => {
      if (!game.user.isGM) {
        ui.notifications.warn("Solo el GM puede abrir la interfaz.");
        return;
      }
      if (!canvas.tokens.controlled.length) {
        ui.notifications.warn("Selecciona un token del viajar para usar la interfaz.");
        return;
      }
      new NavigationForm().render(true);
    },
    visible: true
  });
});

/**
 * Formulario principal con botones de reglas y reset.
 */
class NavigationForm extends FormApplication {
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "navigation-rules-form",
      title: "Reglas de Navegación",
      template: `modules/${MODULE_ID}/templates/navigation.html`,
      width: 350,
      resizable: false,
      closeOnSubmit: false,
      submitOnChange: false
    });
  }

  get actor() {
    const token = canvas.tokens.controlled[0];
    return token?.actor || null;
  }

  async getData() {
    const actor = this.actor;
    const usos = actor ? await loadActorUsos(actor) : {};
    const data = { rules: [], hoy: getTodayString(), isGM: game.user.isGM };
    for (const [key, rule] of Object.entries(RULES)) {
      const inst = usos[key];
      data.rules.push({
        key,
        label: rule.label,
        usado: inst.usado,
        max: rule.max,
        disponible: inst.usado < rule.max,
        dc: rule.dc
      });
    }
    data.canReset = game.user.isGM;
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    html.on("click", ".btn-rule", this._onRuleClick.bind(this));
    html.on("click", ".btn-reset", this._onResetClick.bind(this));
  }

  /**
   * Al hacer click sobre una regla.
   */
  async _onRuleClick(event) {
    event.preventDefault();
    const key = event.currentTarget.dataset.key;
    const rule = RULES[key];
    const actor = this.actor;
    if (!actor) return ui.notifications.warn("No hay actor asociado.");
    const usos = (await loadActorUsos(actor))[key] || { hoy: getTodayString(), usado: 0 };
    if (usos.usado >= rule.max) return ui.notifications.error("Ya no puedes usar esa acción hoy.");
    try {
      if (key === "Ayuda") {
        await rule.onUse(actor);
      } else {
        const roll = rule.skill
          ? await actor.rollAbilitySave(rule.ability, { chatMessage: false, dc: rule.dc, skill: rule.skill })
          : await actor.rollAbilityTest(rule.ability || rule.skill, { chatMessage: false });
        if (roll.total >= rule.dc) await rule.onSuccess(roll, actor);
        else await rule.onFailure(roll, actor);
      }

      usos.usado++;
      await actor.setFlag(MODULE_ID, "usos", { ...{ [key]: usos } });
      this.render(true);
    } catch (err) {
      console.error(err);
      ui.notifications.error("Error al procesar la regla.");
    }
  }

  /**
   * Botón para resetear usos hoy (solo GM).
   */
  async _onResetClick(event) {
    event.preventDefault();
    if (!game.user.isGM) return;
    const nuevos = {};
    const hoy = getTodayString();
    for (const key of Object.keys(RULES)) nuevos[key] = { hoy, usado: 0 };
    for (const actor of game.actors.contents) {
      await actor.setFlag(MODULE_ID, "usos", nuevos);
    }
    ui.notifications.info("Usos diarios reiniciados para todos los actores.");
    this.render(true);
  }
}
