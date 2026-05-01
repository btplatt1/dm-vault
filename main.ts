import {
	App,
	ItemView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	WorkspaceLeaf,
	setIcon,
} from "obsidian";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Creature {
	id: string;
	name: string;
	source: string;
	size: string;
	type: string;
	alignment: string;
	ac: string;
	hp: string;
	speed: string;
	strength: number;
	dexterity: number;
	constitution: number;
	intelligence: number;
	wisdom: number;
	charisma: number;
	savingThrows: string;
	skills: string;
	damageVulnerabilities: string;
	damageResistances: string;
	damageImmunities: string;
	conditionImmunities: string;
	senses: string;
	languages: string;
	cr: string;
	traits: string;
	actions: string;
	bonusActions: string;
	reactions: string;
	legendaryActions: string;
	mythicActions: string;
	lairActions: string;
	regionalEffects: string;
	environment: string;
	treasure: string;
}

interface InitiativeEntry {
	id: string;
	creatureId: string | null; // null = custom/player
	name: string;
	initiative: number;
	hp: number;
	maxHp: number;
	ac: string;
	conditions: string[];
	isPlayer: boolean;
	notes: string;
}

interface DMVaultSettings {
	creatures: Creature[];
	initiative: InitiativeEntry[];
}

const DEFAULT_SETTINGS: DMVaultSettings = {
	creatures: [],
	initiative: [],
};

// ─── Constants ───────────────────────────────────────────────────────────────

const BESTIARY_VIEW_TYPE = "dm-vault-bestiary";
const INITIATIVE_VIEW_TYPE = "dm-vault-initiative";

const CONDITIONS = [
	"Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened",
	"Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified",
	"Poisoned", "Prone", "Restrained", "Stunned", "Unconscious",
];

const SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
const CR_OPTIONS = [
	"0", "1/8", "1/4", "1/2", "1", "2", "3", "4", "5", "6", "7", "8",
	"9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19",
	"20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid(): string {
	return Math.random().toString(36).slice(2, 10);
}

function statMod(score: number): string {
	const m = Math.floor((score - 10) / 2);
	return m >= 0 ? `+${m}` : `${m}`;
}

function crToNum(cr: string): number {
	if (cr === "1/8") return 0.125;
	if (cr === "1/4") return 0.25;
	if (cr === "1/2") return 0.5;
	return parseFloat(cr) || 0;
}

function emptyCreature(): Creature {
	return {
		id: uid(), name: "", source: "", size: "Medium", type: "",
		alignment: "", ac: "", hp: "", speed: "30 ft.", strength: 10,
		dexterity: 10, constitution: 10, intelligence: 10, wisdom: 10,
		charisma: 10, savingThrows: "", skills: "", damageVulnerabilities: "",
		damageResistances: "", damageImmunities: "", conditionImmunities: "",
		senses: "", languages: "", cr: "1", traits: "", actions: "",
		bonusActions: "", reactions: "", legendaryActions: "", mythicActions: "",
		lairActions: "", regionalEffects: "", environment: "", treasure: "",
	};
}

// ─── Statblock Renderer ──────────────────────────────────────────────────────

function renderStatblock(container: HTMLElement, c: Creature) {
	container.empty();
	container.addClass("dv-statblock");

	// Header
	const header = container.createDiv("dv-sb-header");
	header.createDiv("dv-sb-name").setText(c.name);
	const meta = [c.size, c.type].filter(Boolean).join(" ");
	header.createDiv("dv-sb-meta").setText(
		meta + (c.alignment ? `, ${c.alignment}` : "")
	);
	if (c.source) header.createDiv("dv-sb-source").setText(c.source);

	// Body
	const body = container.createDiv("dv-sb-body");

	// Top row
	const topRow = body.createDiv("dv-sb-top-row");
	const crBox = topRow.createDiv("dv-sb-cr-box");
	crBox.createDiv("dv-sb-cr-label").setText("CR");
	crBox.createDiv("dv-sb-cr-val").setText(c.cr || "—");
	const topProps = topRow.createDiv("dv-sb-top-props");
	sbProp(topProps, "Armor Class", c.ac);
	sbProp(topProps, "Hit Points", c.hp);
	sbProp(topProps, "Speed", c.speed);

	body.createDiv("dv-sb-divider");

	// Ability scores
	const statsRow = body.createDiv("dv-sb-stats-row");
	const stats: [string, number][] = [
		["STR", c.strength], ["DEX", c.dexterity], ["CON", c.constitution],
		["INT", c.intelligence], ["WIS", c.wisdom], ["CHA", c.charisma],
	];
	for (const [label, val] of stats) {
		const stat = statsRow.createDiv("dv-sb-stat");
		stat.createDiv("dv-sb-stat-label").setText(label);
		stat.createDiv("dv-sb-stat-score").setText(String(val));
		stat.createDiv("dv-sb-stat-mod").setText(statMod(val));
	}

	body.createDiv("dv-sb-divider");

	// Properties
	sbProp(body, "Saving Throws", c.savingThrows);
	sbProp(body, "Skills", c.skills);
	sbProp(body, "Damage Vulnerabilities", c.damageVulnerabilities);
	sbProp(body, "Damage Resistances", c.damageResistances);
	sbProp(body, "Damage Immunities", c.damageImmunities);
	sbProp(body, "Condition Immunities", c.conditionImmunities);
	sbProp(body, "Senses", c.senses);
	sbProp(body, "Languages", c.languages);

	body.createDiv("dv-sb-divider");

	// Sections
	sbSection(body, "Traits", c.traits, false);
	sbSection(body, "Actions", c.actions, false);
	sbSection(body, "Bonus Actions", c.bonusActions, false);
	sbSection(body, "Reactions", c.reactions, false);

	if (c.legendaryActions || c.mythicActions) {
		body.createDiv("dv-sb-divider dv-sb-divider-gold");
	}
	sbSection(body, "Legendary Actions", c.legendaryActions, true);
	sbSection(body, "Mythic Actions", c.mythicActions, true);
	sbSection(body, "Lair Actions", c.lairActions, false);
	sbSection(body, "Regional Effects", c.regionalEffects, false);

	if (c.environment) {
		body.createDiv("dv-sb-environment").setText(`🌿 Found in: ${c.environment}`);
	}
	sbProp(body, "Treasure", c.treasure);
}

function sbProp(parent: HTMLElement, label: string, value: string) {
	if (!value?.trim()) return;
	const row = parent.createDiv("dv-sb-prop");
	row.createSpan("dv-sb-prop-label").setText(label + " ");
	row.createSpan("dv-sb-prop-value").setText(value);
}

function sbSection(parent: HTMLElement, title: string, text: string, legendary: boolean) {
	if (!text?.trim()) return;
	const section = parent.createDiv(legendary ? "dv-sb-section dv-sb-legendary" : "dv-sb-section");
	section.createDiv("dv-sb-section-title").setText(title);
	const lines = text.split("\n").filter(l => l.trim());
	for (const line of lines) {
		const match = line.match(/^([^.]+)\.\s*(.*)/s);
		const entry = section.createDiv("dv-sb-entry");
		if (match) {
			entry.createEl("strong").createEl("em").setText(match[1].trim() + ". ");
			entry.createSpan().setText(match[2].trim());
		} else {
			entry.setText(line);
		}
	}
}

// ─── Bestiary View ───────────────────────────────────────────────────────────

class BestiaryView extends ItemView {
	plugin: DMVaultPlugin;
	private selectedIds: Set<string> = new Set();
	private searchTerm = "";
	private filterType = "";
	private filterSize = "";
	private filterCR = "";
	private filterLegendary = "";
	private sortCol = "name";
	private sortDir = 1;
	private selectedCreature: Creature | null = null;
	private listEl: HTMLElement;
	private detailEl: HTMLElement;
	private countEl: HTMLElement;

	constructor(leaf: WorkspaceLeaf, plugin: DMVaultPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() { return BESTIARY_VIEW_TYPE; }
	getDisplayText() { return "DM Vault — Bestiary"; }
	getIcon() { return "skull"; }

	async onOpen() {
		this.build();
	}

	build() {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass("dv-bestiary-root");

		// ── Toolbar ──
		const toolbar = root.createDiv("dv-toolbar");

		const addBtn = toolbar.createEl("button", { cls: "dv-btn dv-btn-primary", text: "+ Add" });
		addBtn.onclick = () => this.openForm(null);

		const deleteBtn = toolbar.createEl("button", { cls: "dv-btn dv-btn-danger", text: "Delete Selected" });
		deleteBtn.onclick = () => this.deleteSelected();

		this.countEl = toolbar.createDiv("dv-count");

		// ── Search & Filters ──
		const filters = root.createDiv("dv-filters");

		const searchInput = filters.createEl("input", {
			cls: "dv-search",
			attr: { placeholder: "Search monsters…", type: "text" },
		});
		searchInput.oninput = () => { this.searchTerm = searchInput.value; this.renderList(); };

		const typeInput = filters.createEl("input", {
			cls: "dv-filter-input",
			attr: { placeholder: "Type…", type: "text" },
		});
		typeInput.oninput = () => { this.filterType = typeInput.value; this.renderList(); };

		const sizeSelect = filters.createEl("select", { cls: "dv-filter-select" });
		[["", "All Sizes"], ...SIZES.map(s => [s, s])].forEach(([v, t]) => {
			sizeSelect.createEl("option", { value: v, text: t });
		});
		sizeSelect.onchange = () => { this.filterSize = sizeSelect.value; this.renderList(); };

		const crSelect = filters.createEl("select", { cls: "dv-filter-select" });
		[["", "All CR"], ...CR_OPTIONS.map(c => [c, `CR ${c}`])].forEach(([v, t]) => {
			crSelect.createEl("option", { value: v, text: t });
		});
		crSelect.onchange = () => { this.filterCR = crSelect.value; this.renderList(); };

		const legSelect = filters.createEl("select", { cls: "dv-filter-select" });
		[["", "Legendary?"], ["yes", "★ Legendary"], ["no", "Non-Legendary"]].forEach(([v, t]) => {
			legSelect.createEl("option", { value: v, text: t });
		});
		legSelect.onchange = () => { this.filterLegendary = legSelect.value; this.renderList(); };

		// ── Main split: list + detail ──
		const main = root.createDiv("dv-main-split");

		// List panel
		const listPanel = main.createDiv("dv-list-panel");

		// Sort headers
		const sortBar = listPanel.createDiv("dv-sort-bar");
		const cols: [string, string][] = [["name", "Name"], ["cr", "CR"], ["type", "Type"], ["size", "Size"]];
		for (const [col, label] of cols) {
			const btn = sortBar.createEl("button", { cls: "dv-sort-btn", text: label });
			btn.onclick = () => {
				if (this.sortCol === col) this.sortDir *= -1;
				else { this.sortCol = col; this.sortDir = 1; }
				this.renderList();
			};
		}

		this.listEl = listPanel.createDiv("dv-list");

		// Detail panel
		this.detailEl = main.createDiv("dv-detail-panel");
		this.detailEl.createDiv("dv-detail-empty").setText("Select a creature to view its statblock.");

		this.renderList();
	}

	getFiltered(): Creature[] {
		let list = [...this.plugin.settings.creatures];
		const q = this.searchTerm.toLowerCase();
		if (q) list = list.filter(c =>
			c.name.toLowerCase().includes(q) ||
			c.type.toLowerCase().includes(q) ||
			c.source.toLowerCase().includes(q)
		);
		if (this.filterType) list = list.filter(c => c.type.toLowerCase().includes(this.filterType.toLowerCase()));
		if (this.filterSize) list = list.filter(c => c.size === this.filterSize);
		if (this.filterCR) list = list.filter(c => c.cr === this.filterCR);
		if (this.filterLegendary === "yes") list = list.filter(c => !!c.legendaryActions?.trim());
		if (this.filterLegendary === "no") list = list.filter(c => !c.legendaryActions?.trim());

		list.sort((a, b) => {
			let av: string | number = (a as any)[this.sortCol] ?? "";
			let bv: string | number = (b as any)[this.sortCol] ?? "";
			if (this.sortCol === "cr") { av = crToNum(a.cr); bv = crToNum(b.cr); }
			if (typeof av === "number") return (av - (bv as number)) * this.sortDir;
			return String(av).localeCompare(String(bv)) * this.sortDir;
		});
		return list;
	}

	renderList() {
		this.listEl.empty();
		const filtered = this.getFiltered();
		this.countEl.setText(`${filtered.length} creature${filtered.length !== 1 ? "s" : ""}`);

		if (!filtered.length) {
			this.listEl.createDiv("dv-empty").setText("No creatures found.");
			return;
		}

		for (const creature of filtered) {
			const row = this.listEl.createDiv("dv-list-row");
			if (this.selectedIds.has(creature.id)) row.addClass("dv-list-row-checked");
			if (this.selectedCreature?.id === creature.id) row.addClass("dv-list-row-selected");

			// Checkbox
			const cb = row.createEl("input", { attr: { type: "checkbox" } }) as HTMLInputElement;
			cb.checked = this.selectedIds.has(creature.id);
			cb.onclick = (e) => {
				e.stopPropagation();
				if (cb.checked) this.selectedIds.add(creature.id);
				else this.selectedIds.delete(creature.id);
				row.toggleClass("dv-list-row-checked", cb.checked);
			};

			// Info
			const info = row.createDiv("dv-list-info");
			info.createDiv("dv-list-name").setText(creature.name || "Unnamed");
			const meta = info.createDiv("dv-list-meta");
			meta.setText([
				creature.cr ? `CR ${creature.cr}` : "",
				creature.size,
				creature.type,
			].filter(Boolean).join(" · "));

			if (creature.legendaryActions?.trim()) {
				row.createDiv("dv-legendary-badge").setText("★");
			}

			// Action buttons
			const actions = row.createDiv("dv-list-actions");

			const editBtn = actions.createEl("button", { cls: "dv-icon-btn", attr: { title: "Edit" } });
			setIcon(editBtn, "pencil");
			editBtn.onclick = (e) => { e.stopPropagation(); this.openForm(creature); };

			const addToInit = actions.createEl("button", { cls: "dv-icon-btn", attr: { title: "Add to Initiative" } });
			setIcon(addToInit, "swords");
			addToInit.onclick = (e) => { e.stopPropagation(); this.addToInitiative(creature); };

			const delBtn = actions.createEl("button", { cls: "dv-icon-btn dv-icon-btn-danger", attr: { title: "Delete" } });
			setIcon(delBtn, "trash-2");
			delBtn.onclick = (e) => { e.stopPropagation(); this.deleteSingle(creature); };

			// Click row → show statblock
			row.onclick = () => {
				this.selectedCreature = creature;
				this.renderDetail(creature);
				this.listEl.querySelectorAll(".dv-list-row-selected").forEach(r => r.removeClass("dv-list-row-selected"));
				row.addClass("dv-list-row-selected");
			};
		}
	}

	renderDetail(creature: Creature) {
		this.detailEl.empty();

		// Detail toolbar
		const dtoolbar = this.detailEl.createDiv("dv-detail-toolbar");
		const editBtn = dtoolbar.createEl("button", { cls: "dv-btn dv-btn-sm", text: "✏ Edit" });
		editBtn.onclick = () => this.openForm(creature);
		const initBtn = dtoolbar.createEl("button", { cls: "dv-btn dv-btn-sm dv-btn-primary", text: "⚔ Add to Initiative" });
		initBtn.onclick = () => this.addToInitiative(creature);

		renderStatblock(this.detailEl, creature);
	}

	async deleteSingle(creature: Creature) {
		if (!confirm(`Delete ${creature.name}?`)) return;
		this.plugin.settings.creatures = this.plugin.settings.creatures.filter(c => c.id !== creature.id);
		await this.plugin.saveSettings();
		if (this.selectedCreature?.id === creature.id) {
			this.selectedCreature = null;
			this.detailEl.empty();
			this.detailEl.createDiv("dv-detail-empty").setText("Select a creature to view its statblock.");
		}
		this.renderList();
		new Notice(`${creature.name} deleted.`);
	}

	async deleteSelected() {
		if (!this.selectedIds.size) { new Notice("No creatures selected."); return; }
		const names = this.plugin.settings.creatures
			.filter(c => this.selectedIds.has(c.id))
			.map(c => c.name).join(", ");
		if (!confirm(`Delete ${this.selectedIds.size} creature(s)?\n${names}`)) return;
		this.plugin.settings.creatures = this.plugin.settings.creatures.filter(c => !this.selectedIds.has(c.id));
		this.selectedIds.clear();
		if (this.selectedCreature && !this.plugin.settings.creatures.find(c => c.id === this.selectedCreature?.id)) {
			this.selectedCreature = null;
			this.detailEl.empty();
			this.detailEl.createDiv("dv-detail-empty").setText("Select a creature to view its statblock.");
		}
		await this.plugin.saveSettings();
		this.renderList();
		new Notice(`${this.selectedIds.size === 0 ? names.split(",").length : this.selectedIds.size} creature(s) deleted.`);
	}

	addToInitiative(creature: Creature) {
		const entry: InitiativeEntry = {
			id: uid(),
			creatureId: creature.id,
			name: creature.name,
			initiative: 0,
			hp: parseInt(creature.hp) || 10,
			maxHp: parseInt(creature.hp) || 10,
			ac: creature.ac,
			conditions: [],
			isPlayer: false,
			notes: "",
		};
		this.plugin.settings.initiative.push(entry);
		this.plugin.saveSettings();
		this.plugin.activateInitiativeView();
		new Notice(`${creature.name} added to initiative.`);
	}

	openForm(creature: Creature | null) {
		new CreatureFormModal(this.app, this.plugin, creature, () => {
			this.renderList();
			if (this.selectedCreature) {
				const updated = this.plugin.settings.creatures.find(c => c.id === this.selectedCreature?.id);
				if (updated) this.renderDetail(updated);
			}
		}).open();
	}

	async onClose() {}
}

// ─── Creature Form Modal ─────────────────────────────────────────────────────

class CreatureFormModal extends Modal {
	plugin: DMVaultPlugin;
	creature: Creature;
	isEdit: boolean;
	onSave: () => void;

	constructor(app: App, plugin: DMVaultPlugin, creature: Creature | null, onSave: () => void) {
		super(app);
		this.plugin = plugin;
		this.isEdit = !!creature;
		this.creature = creature ? { ...creature } : emptyCreature();
		this.onSave = onSave;
	}

	onOpen() {
		this.modalEl.addClass("dv-form-modal");
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: this.isEdit ? `Edit: ${this.creature.name}` : "Add Creature" });

		const form = contentEl.createDiv("dv-form");

		// Helper — creates a field group inside `target`
		const field = (target: HTMLElement, label: string, key: keyof Creature, type = "text", opts?: string[]) => {
			const group = target.createDiv("dv-form-group");
			group.createEl("label", { text: label, cls: "dv-form-label" });
			if (opts) {
				const sel = group.createEl("select", { cls: "dv-form-input" }) as HTMLSelectElement;
				opts.forEach(o => sel.createEl("option", { value: o, text: o }));
				sel.value = String(this.creature[key] ?? "");
				sel.onchange = () => (this.creature as any)[key] = sel.value;
			} else if (type === "textarea") {
				const ta = group.createEl("textarea", { cls: "dv-form-input dv-form-textarea" }) as HTMLTextAreaElement;
				ta.value = String(this.creature[key] ?? "");
				ta.oninput = () => (this.creature as any)[key] = ta.value;
			} else {
				const inp = group.createEl("input", { cls: "dv-form-input", attr: { type } }) as HTMLInputElement;
				inp.value = String(this.creature[key] ?? "");
				inp.oninput = () => {
					(this.creature as any)[key] = type === "number" ? parseInt(inp.value) || 0 : inp.value;
				};
			}
		};

		// Sections
		this.section(form, "Identity");
		const identityGrid = form.createDiv("dv-form-grid");
		field(identityGrid, "Name *", "name");
		field(identityGrid, "Source", "source");
		field(identityGrid, "Size", "size", "text", SIZES);
		field(identityGrid, "Type", "type");
		field(identityGrid, "Alignment", "alignment");
		field(identityGrid, "CR", "cr", "text", CR_OPTIONS);

		this.section(form, "Combat");
		const combatGrid = form.createDiv("dv-form-grid");
		field(combatGrid, "AC", "ac");
		field(combatGrid, "HP", "hp");
		field(combatGrid, "Speed", "speed");

		this.section(form, "Ability Scores");
		const statsGrid = form.createDiv("dv-form-grid dv-form-grid-6");
		field(statsGrid, "STR", "strength", "number");
		field(statsGrid, "DEX", "dexterity", "number");
		field(statsGrid, "CON", "constitution", "number");
		field(statsGrid, "INT", "intelligence", "number");
		field(statsGrid, "WIS", "wisdom", "number");
		field(statsGrid, "CHA", "charisma", "number");

		this.section(form, "Proficiencies & Defenses");
		const defGrid = form.createDiv("dv-form-grid");
		field(defGrid, "Saving Throws", "savingThrows");
		field(defGrid, "Skills", "skills");
		field(defGrid, "Damage Vulnerabilities", "damageVulnerabilities");
		field(defGrid, "Damage Resistances", "damageResistances");
		field(defGrid, "Damage Immunities", "damageImmunities");
		field(defGrid, "Condition Immunities", "conditionImmunities");
		field(defGrid, "Senses", "senses");
		field(defGrid, "Languages", "languages");

		this.section(form, "Abilities & Actions");
		field(form, "Traits", "traits", "textarea");
		field(form, "Actions", "actions", "textarea");
		field(form, "Bonus Actions", "bonusActions", "textarea");
		field(form, "Reactions", "reactions", "textarea");
		field(form, "Legendary Actions", "legendaryActions", "textarea");
		field(form, "Mythic Actions", "mythicActions", "textarea");
		field(form, "Lair Actions", "lairActions", "textarea");
		field(form, "Regional Effects", "regionalEffects", "textarea");

		this.section(form, "Lore");
		const loreGrid = form.createDiv("dv-form-grid");
		field(loreGrid, "Environment", "environment");
		field(loreGrid, "Treasure", "treasure");

		// Buttons
		const btnRow = form.createDiv("dv-form-btns");
		const cancel = btnRow.createEl("button", { cls: "dv-btn", text: "Cancel" });
		cancel.onclick = () => this.close();
		const save = btnRow.createEl("button", { cls: "dv-btn dv-btn-primary", text: this.isEdit ? "Save Changes" : "Add Creature" });
		save.onclick = () => this.save();
	}

	section(parent: HTMLElement, title: string) {
		parent.createDiv("dv-form-section-title").setText(title);
	}

	async save() {
		if (!this.creature.name.trim()) { new Notice("Name is required."); return; }
		if (this.isEdit) {
			const idx = this.plugin.settings.creatures.findIndex(c => c.id === this.creature.id);
			if (idx >= 0) this.plugin.settings.creatures[idx] = this.creature;
		} else {
			this.plugin.settings.creatures.push(this.creature);
		}
		await this.plugin.saveSettings();
		this.onSave();
		this.close();
		new Notice(`${this.creature.name} ${this.isEdit ? "updated" : "added"}.`);
	}

	onClose() { this.contentEl.empty(); }
}

// ─── Initiative Tracker View ──────────────────────────────────────────────────

class InitiativeView extends ItemView {
	plugin: DMVaultPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: DMVaultPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType() { return INITIATIVE_VIEW_TYPE; }
	getDisplayText() { return "DM Vault — Initiative"; }
	getIcon() { return "swords"; }

	async onOpen() { this.build(); }

	build() {
		const root = this.containerEl.children[1] as HTMLElement;
		root.empty();
		root.addClass("dv-initiative-root");

		// Toolbar
		const toolbar = root.createDiv("dv-toolbar");

		const addPlayerBtn = toolbar.createEl("button", { cls: "dv-btn", text: "+ Player" });
		addPlayerBtn.onclick = () => this.addCustom(true);

		const addCustomBtn = toolbar.createEl("button", { cls: "dv-btn", text: "+ Custom" });
		addCustomBtn.onclick = () => this.addCustom(false);

		const sortBtn = toolbar.createEl("button", { cls: "dv-btn dv-btn-primary", text: "⬇ Sort by Initiative" });
		sortBtn.onclick = () => this.sortByInitiative();

		const clearBtn = toolbar.createEl("button", { cls: "dv-btn dv-btn-danger", text: "✕ Clear All" });
		clearBtn.onclick = () => this.clearAll();

		const pushBtn = toolbar.createEl("button", { cls: "dv-btn", text: "⟶ Initiative Tracker" });
		pushBtn.setAttribute("title", "Push to the Initiative Tracker plugin");
		pushBtn.onclick = () => this.pushToInitiativeTracker();

		// Entry list
		this.renderEntries(root);
	}

	renderEntries(root: HTMLElement) {
		// Remove old list if present
		root.querySelectorAll(".dv-init-list").forEach(el => el.remove());
		const list = root.createDiv("dv-init-list");

		if (!this.plugin.settings.initiative.length) {
			list.createDiv("dv-empty").setText("No creatures in initiative. Add from the Bestiary or use + Custom.");
			return;
		}

		for (const entry of this.plugin.settings.initiative) {
			const row = list.createDiv("dv-init-row" + (entry.isPlayer ? " dv-init-player" : ""));

			// Initiative input
			const initWrap = row.createDiv("dv-init-initiative-wrap");
			initWrap.createDiv("dv-init-label").setText("Init");
			const initInp = initWrap.createEl("input", {
				cls: "dv-init-input dv-init-num",
				attr: { type: "number", value: String(entry.initiative) },
			}) as HTMLInputElement;
			initInp.onchange = async () => {
				entry.initiative = parseInt(initInp.value) || 0;
				await this.plugin.saveSettings();
			};

			// Name + AC
			const nameWrap = row.createDiv("dv-init-name-wrap");
			nameWrap.createDiv("dv-init-name").setText(entry.name);
			if (entry.ac) nameWrap.createDiv("dv-init-ac").setText(`AC ${entry.ac}`);

			// HP bar
			const hpWrap = row.createDiv("dv-init-hp-wrap");
			hpWrap.createDiv("dv-init-label").setText("HP");
			const hpInp = hpWrap.createEl("input", {
				cls: "dv-init-input dv-init-num",
				attr: { type: "number", value: String(entry.hp) },
			}) as HTMLInputElement;
			hpInp.onchange = async () => {
				entry.hp = parseInt(hpInp.value) || 0;
				await this.plugin.saveSettings();
				this.updateHpBar(hpBar, entry);
			};
			hpWrap.createSpan({ cls: "dv-init-hp-sep", text: " / " });
			hpWrap.createSpan({ cls: "dv-init-hp-max", text: String(entry.maxHp) });

			const hpBar = row.createDiv("dv-init-hp-bar-wrap").createDiv("dv-init-hp-bar");
			this.updateHpBar(hpBar, entry);

			// Quick HP buttons
			const dmgWrap = row.createDiv("dv-init-dmg-wrap");
			const dmgInp = dmgWrap.createEl("input", {
				cls: "dv-init-input dv-init-num",
				attr: { type: "number", placeholder: "Amt" },
			}) as HTMLInputElement;
			const dmgBtn = dmgWrap.createEl("button", { cls: "dv-btn dv-btn-sm dv-btn-danger", text: "Dmg" });
			dmgBtn.onclick = async () => {
				const amt = parseInt(dmgInp.value) || 0;
				entry.hp = Math.max(0, entry.hp - amt);
				hpInp.value = String(entry.hp);
				this.updateHpBar(hpBar, entry);
				dmgInp.value = "";
				await this.plugin.saveSettings();
			};
			const healBtn = dmgWrap.createEl("button", { cls: "dv-btn dv-btn-sm dv-btn-success", text: "Heal" });
			healBtn.onclick = async () => {
				const amt = parseInt(dmgInp.value) || 0;
				entry.hp = Math.min(entry.maxHp, entry.hp + amt);
				hpInp.value = String(entry.hp);
				this.updateHpBar(hpBar, entry);
				dmgInp.value = "";
				await this.plugin.saveSettings();
			};

			// Conditions
			const condWrap = row.createDiv("dv-init-cond-wrap");
			const condSelect = condWrap.createEl("select", { cls: "dv-init-cond-select" }) as HTMLSelectElement;
			condSelect.createEl("option", { value: "", text: "+ Condition" });
			CONDITIONS.forEach(c => condSelect.createEl("option", { value: c, text: c }));
			condSelect.onchange = async () => {
				if (!condSelect.value) return;
				if (!entry.conditions.includes(condSelect.value)) {
					entry.conditions.push(condSelect.value);
					await this.plugin.saveSettings();
					this.renderConditions(condBadges, entry);
				}
				condSelect.value = "";
			};
			const condBadges = condWrap.createDiv("dv-init-cond-badges");
			this.renderConditions(condBadges, entry);

			// View statblock button
			if (entry.creatureId) {
				const viewBtn = row.createEl("button", { cls: "dv-icon-btn", attr: { title: "View Statblock" } });
				setIcon(viewBtn, "eye");
				viewBtn.onclick = () => {
					const creature = this.plugin.settings.creatures.find(c => c.id === entry.creatureId);
					if (creature) new StatblockModal(this.app, creature).open();
				};
			}

			// Remove button
			const removeBtn = row.createEl("button", { cls: "dv-icon-btn dv-icon-btn-danger", attr: { title: "Remove" } });
			setIcon(removeBtn, "x");
			removeBtn.onclick = async () => {
				this.plugin.settings.initiative = this.plugin.settings.initiative.filter(e => e.id !== entry.id);
				await this.plugin.saveSettings();
				this.build();
			};
		}
	}

	renderConditions(container: HTMLElement, entry: InitiativeEntry) {
		container.empty();
		for (const cond of entry.conditions) {
			const badge = container.createDiv("dv-cond-badge");
			badge.setText(cond);
			badge.onclick = async () => {
				entry.conditions = entry.conditions.filter(c => c !== cond);
				await this.plugin.saveSettings();
				container.removeChild(badge);
			};
		}
	}

	updateHpBar(bar: HTMLElement, entry: InitiativeEntry) {
		const pct = entry.maxHp > 0 ? Math.max(0, Math.min(100, (entry.hp / entry.maxHp) * 100)) : 0;
		bar.style.width = `${pct}%`;
		bar.removeClass("dv-hp-full", "dv-hp-mid", "dv-hp-low", "dv-hp-dead");
		if (pct === 0) bar.addClass("dv-hp-dead");
		else if (pct <= 25) bar.addClass("dv-hp-low");
		else if (pct <= 50) bar.addClass("dv-hp-mid");
		else bar.addClass("dv-hp-full");
	}

	addCustom(isPlayer: boolean) {
		new CustomInitiativeModal(this.app, this.plugin, isPlayer, () => this.build()).open();
	}

	async sortByInitiative() {
		this.plugin.settings.initiative.sort((a, b) => b.initiative - a.initiative);
		await this.plugin.saveSettings();
		this.build();
	}

	async clearAll() {
		if (!confirm("Clear all initiative entries?")) return;
		this.plugin.settings.initiative = [];
		await this.plugin.saveSettings();
		this.build();
	}

	pushToInitiativeTracker() {
		// Push to the Initiative Tracker plugin (by javalent)
		const tracker = (this.app as any).plugins?.plugins?.["initiative-tracker"];
		if (!tracker) {
			new Notice("Initiative Tracker plugin not found or not enabled.");
			return;
		}
		try {
			// Initiative Tracker exposes an API
			const api = tracker.api ?? tracker;
			for (const entry of this.plugin.settings.initiative) {
				if (api.addCreature) {
					api.addCreature({
						name: entry.name,
						initiative: entry.initiative,
						hp: entry.hp,
						ac: parseInt(entry.ac) || undefined,
					});
				}
			}
			new Notice(`${this.plugin.settings.initiative.length} entries pushed to Initiative Tracker.`);
		} catch (e) {
			new Notice("Could not push to Initiative Tracker. Check console for details.");
			console.error("DM Vault → Initiative Tracker error:", e);
		}
	}

	async onClose() {}
}

// ─── Custom Initiative Entry Modal ───────────────────────────────────────────

class CustomInitiativeModal extends Modal {
	plugin: DMVaultPlugin;
	isPlayer: boolean;
	onSave: () => void;
	entry: Partial<InitiativeEntry> = { name: "", initiative: 0, hp: 10, maxHp: 10, ac: "", conditions: [], notes: "" };

	constructor(app: App, plugin: DMVaultPlugin, isPlayer: boolean, onSave: () => void) {
		super(app);
		this.plugin = plugin;
		this.isPlayer = isPlayer;
		this.onSave = onSave;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.createEl("h2", { text: this.isPlayer ? "Add Player" : "Add Custom Creature" });

		const f = (label: string, key: string, type = "text") => {
			const g = contentEl.createDiv("dv-form-group");
			g.createEl("label", { text: label, cls: "dv-form-label" });
			const inp = g.createEl("input", { cls: "dv-form-input", attr: { type } }) as HTMLInputElement;
			inp.value = String((this.entry as any)[key] ?? "");
			inp.oninput = () => (this.entry as any)[key] = type === "number" ? parseInt(inp.value) || 0 : inp.value;
		};

		f("Name *", "name");
		f("Initiative", "initiative", "number");
		f("Max HP", "maxHp", "number");
		f("AC", "ac");

		const btns = contentEl.createDiv("dv-form-btns");
		btns.createEl("button", { cls: "dv-btn", text: "Cancel" }).onclick = () => this.close();
		const save = btns.createEl("button", { cls: "dv-btn dv-btn-primary", text: "Add" });
		save.onclick = async () => {
			if (!this.entry.name?.trim()) { new Notice("Name required."); return; }
			this.entry.id = uid();
			this.entry.creatureId = null;
			this.entry.isPlayer = this.isPlayer;
			this.entry.hp = this.entry.maxHp ?? 10;
			this.entry.conditions = [];
			this.plugin.settings.initiative.push(this.entry as InitiativeEntry);
			await this.plugin.saveSettings();
			this.onSave();
			this.close();
		};
	}

	onClose() { this.contentEl.empty(); }
}

// ─── Quick Statblock Modal ────────────────────────────────────────────────────

class StatblockModal extends Modal {
	creature: Creature;

	constructor(app: App, creature: Creature) {
		super(app);
		this.creature = creature;
		this.modalEl.addClass("dv-statblock-modal");
	}

	onOpen() {
		renderStatblock(this.contentEl, this.creature);
	}

	onClose() { this.contentEl.empty(); }
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default class DMVaultPlugin extends Plugin {
	settings: DMVaultSettings;

	async onload() {
		await this.loadSettings();

		// Register views
		this.registerView(BESTIARY_VIEW_TYPE, (leaf) => new BestiaryView(leaf, this));
		this.registerView(INITIATIVE_VIEW_TYPE, (leaf) => new InitiativeView(leaf, this));

		// Ribbon icons
		this.addRibbonIcon("skull", "DM Vault — Bestiary", () => this.activateBestiaryView());
		this.addRibbonIcon("swords", "DM Vault — Initiative", () => this.activateInitiativeView());

		// Commands
		this.addCommand({
			id: "open-bestiary",
			name: "Open Bestiary",
			callback: () => this.activateBestiaryView(),
		});
		this.addCommand({
			id: "open-initiative",
			name: "Open Initiative Tracker",
			callback: () => this.activateInitiativeView(),
		});
		this.addCommand({
			id: "add-creature",
			name: "Add Creature",
			callback: () => {
				new CreatureFormModal(this.app, this, null, () => {
					this.refreshBestiaryView();
				}).open();
			},
		});
		this.addCommand({
			id: "clear-initiative",
			name: "Clear Initiative",
			callback: async () => {
				this.settings.initiative = [];
				await this.saveSettings();
				this.refreshInitiativeView();
				new Notice("Initiative cleared.");
			},
		});

		// Settings tab
		this.addSettingTab(new DMVaultSettingTab(this.app, this));
	}

	async activateBestiaryView() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(BESTIARY_VIEW_TYPE)[0];
		if (!leaf) {
			leaf = workspace.getLeftLeaf(false)!;
			await leaf.setViewState({ type: BESTIARY_VIEW_TYPE, active: true });
		}
		workspace.revealLeaf(leaf);
	}

	async activateInitiativeView() {
		const { workspace } = this.app;
		let leaf = workspace.getLeavesOfType(INITIATIVE_VIEW_TYPE)[0];
		if (!leaf) {
			leaf = workspace.getRightLeaf(false)!;
			await leaf.setViewState({ type: INITIATIVE_VIEW_TYPE, active: true });
		}
		workspace.revealLeaf(leaf);
	}

	refreshBestiaryView() {
		this.app.workspace.getLeavesOfType(BESTIARY_VIEW_TYPE).forEach(leaf => {
			(leaf.view as BestiaryView).renderList();
		});
	}

	refreshInitiativeView() {
		this.app.workspace.getLeavesOfType(INITIATIVE_VIEW_TYPE).forEach(leaf => {
			(leaf.view as InitiativeView).build();
		});
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {}
}

// ─── Settings Tab ─────────────────────────────────────────────────────────────

class DMVaultSettingTab extends PluginSettingTab {
	plugin: DMVaultPlugin;

	constructor(app: App, plugin: DMVaultPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display() {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "DM Vault Settings" });

		new Setting(containerEl)
			.setName("Creature count")
			.setDesc(`You have ${this.plugin.settings.creatures.length} creature(s) in your bestiary.`);

		new Setting(containerEl)
			.setName("Export bestiary")
			.setDesc("Download all creatures as a JSON backup.")
			.addButton(btn => btn.setButtonText("Export JSON").onClick(() => {
				const blob = new Blob([JSON.stringify(this.plugin.settings.creatures, null, 2)], { type: "application/json" });
				const a = document.createElement("a");
				a.href = URL.createObjectURL(blob);
				a.download = "dm-vault-bestiary.json";
				a.click();
			}));

		new Setting(containerEl)
			.setName("Import bestiary")
			.setDesc("Import creatures from a JSON file (adds to existing).")
			.addButton(btn => btn.setButtonText("Import JSON").onClick(() => {
				const input = document.createElement("input");
				input.type = "file";
				input.accept = ".json";
				input.onchange = async () => {
					const file = input.files?.[0];
					if (!file) return;
					const text = await file.text();
					try {
						const imported = JSON.parse(text);
						if (!Array.isArray(imported)) { new Notice("Invalid file format."); return; }
						// Assign new IDs to avoid conflicts
						const withIds = imported.map((c: Creature) => ({ ...c, id: uid() }));
						this.plugin.settings.creatures.push(...withIds);
						await this.plugin.saveSettings();
						this.plugin.refreshBestiaryView();
						new Notice(`${withIds.length} creature(s) imported.`);
						this.display();
					} catch {
						new Notice("Failed to parse JSON file.");
					}
				};
				input.click();
			}));

		new Setting(containerEl)
			.setName("Clear all creatures")
			.setDesc("⚠ Permanently delete all creatures from the bestiary.")
			.addButton(btn => btn.setButtonText("Clear All").setWarning().onClick(async () => {
				if (!confirm(`Delete all ${this.plugin.settings.creatures.length} creatures?`)) return;
				this.plugin.settings.creatures = [];
				await this.plugin.saveSettings();
				this.plugin.refreshBestiaryView();
				new Notice("Bestiary cleared.");
				this.display();
			}));
	}
}
