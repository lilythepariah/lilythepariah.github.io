const $ = (selector) => document.querySelector(selector);
const $fn = (selector, fn) => document.querySelectorAll(selector).forEach(fn);

const mq = matchMedia("(max-width: 900px)");
const mobile = () => mq.matches;

const preview         = $("#preview");
const backdrop        = $("#backdrop");
const preview_image   = preview.querySelector("img");
const preview_caption = preview.querySelector(".caption");
const preview_close   = $("#preview_close");
const lightbox        = $("#lightbox");
const lightbox_image  = $("#lightbox_img");

function open_dialog() {
	preview.classList.add("open");
	backdrop.classList.add("show");
}

function close_dialog() {
	preview.classList.remove("open");
	backdrop.classList.remove("show");
}

function open_lightbox() {
	lightbox_image.src = preview_image.src;
	lightbox.classList.add("show");
}

function close_lightbox() {
	lightbox.classList.remove("show");
}	

{
	let hints_data;

	fetch("./hints.json")
		.then(response => {
			if (!response.ok)
				throw new Error(`HTTP error! Status: ${response.status}`);
			return response.json();
		})
		.then(data => { hints_data = data; });
	
	function show_preview(item) {
		preview_image.src = `hints_img/${item}.webp`;
	
		// this rebuilds the tree every time which is quite expensive but whatever its like 2 dom elements so like meh
		let hint = hints_data[item];
		if (hint)
			preview_caption.innerHTML = `<h3>${hint.heading}</h3>${hint.paragraph || ""}`;
	
		if (mobile()) open_dialog();
	}
}

{
	const COLOR_ORDER = [
		"#fff",
		"#fff",
		"#ffff55",
		"#ffaa00",
		"#ff5555",
		"#ff5555",
	];

	const COLOR_ORDER_LENGTH = COLOR_ORDER.length;
	const NUMBER_FORMATTER = new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	});
	
	/**
	 * return an array of colored spans that looks like a damage splash in game.
	 * 
	 * @param {number} damage - the damage it changes to
	 * @returns {Array} array containing the spans
	 */
	const damage_splash = (damage) => {
		let spans = [];
	
		for (let s = `✧${NUMBER_FORMATTER.format(Math.round(damage))}✧`, i = 0; i < s.length; ++i) {
			let span = document.createElement("span");
			span.textContent = s[i];
			span.style.color = COLOR_ORDER[i % COLOR_ORDER_LENGTH];
			spans.push(span);
		}
	
		return spans;
	}

	const damage_sprite  = $("#damage_sprite");
	function render_damage_splash(damage) {
		damage_sprite.replaceChildren(...damage_splash(damage));
	}
}

{
	const text_at_least  = $("#solution_text_at_least");
	const text_s         = $("#solution_text_s");
	const solution_size  = $("#solution_size");
	const solution_panel = $("#solution_panel");

	const icon_str = "/resources/skyblock/stat_icons/strength.webp";
	const icon_cd  = "/resources/skyblock/stat_icons/crit_damage.webp";
 
	const pool = [];

	const e = (c, type) => {
		const e = document.createElement(type || "div");
		c && e.classList.add(c);
		return e;
	};


	/*
	 * 	<div class="panel_row">
	 *		<div class="label">bizarre</div>
 	 *		<div class="solution_answer">
	 *			<div><div>30</div><img class="stat_icon" src="/resources/skyblock/stat_icons/strength.webp"></div>
	 *			<div><div>140</div><img class="stat_icon" src="/resources/skyblock/stat_icons/crit_damage.webp"></div>
	 *		</div>
	 *	</div>
	 */
	const row = (power, str, cd) => {
		const panel_row = e("panel_row");

		const label = e("label");
		const answer = e("solution_answer");

		const r0 = e(); const str_text = e(); r0.appendChild(str_text); r0.appendChild(e("stat_icon", "img")).src = icon_str;
		const r1 = e(); const cd_text  = e(); r1.appendChild(cd_text);  r1.appendChild(e("stat_icon", "img")).src = icon_cd;

		answer.append(r0, r1);
		panel_row.append(label, answer);

		const values = (a, b, c) => {
			label.textContent = a;
			str_text.textContent = b;
			cd_text.textContent = c;
		};
		values(power, str, cd);

		return {row : panel_row, values};
	}

	function render_solutions(solutions) {
		let size = solutions.length;

		text_at_least.classList.toggle("hide", size == 0);
		text_s.classList.toggle("hide", size == 1);
		solution_size.textContent = size == 0 ? "no" : size;

		for (let s = solutions[pool.length]; pool.length < size;)
			pool.push(row(s.name, s.str_tuning, s.cd_tuning));

		for (let i = 0, s = solutions[i]; i < size; s = solutions[++i])
			pool[i].values(s.name, s.str_tuning, s.cd_tuning);

		let rendered = solution_panel.children.length - 1;
		while (rendered > size) 
			solution_panel.removeChild(pool[--rendered].row);
		
		while (rendered < size)
			solution_panel.appendChild(pool[rendered++].row);
	}
}


{
	let powers;
	fetch("/resources/skyblock/accessory_powers.json")
		.then(response => {
			if (!response.ok)
				throw new Error(`HTTP error! Status: ${response.status}`);
			return response.json();
		})
		.then(data => { powers = data; update();});

	const get_ap_multiplier = (ap) => 29.97 * Math.log(0.0019 * ap + 1) ** 1.2;

	const EPSILON = 1 - 2 ** -20;
	function solve(str, cd, str_mult, cd_mult, dmg_bonus, ap, tp, damage, desired_damage) {
		const results = [];

		const WEAPON_DAMAGE = damage + 5;
		const AP_MULTIPLIER = get_ap_multiplier(ap);
		const DAMAGE_MULTIPLIER = WEAPON_DAMAGE * (1 + dmg_bonus);
		const INV_DAMAGE_MULTIPLIER =  1 / DAMAGE_MULTIPLIER;
		const INV_STR_MULT = 1 / str_mult;
		const INV_CD_MULT = 1 / cd_mult;

		const dmg_per_S_CD = DAMAGE_MULTIPLIER *  0.0001;
		const TARGET_HI = desired_damage + EPSILON;
		const Q_low  = 10000 * desired_damage * INV_DAMAGE_MULTIPLIER;
		const Q_high = 10000 * TARGET_HI * INV_DAMAGE_MULTIPLIER;


		for (const power of powers) {
			const STR_PRE_MULT = str + AP_MULTIPLIER * power.multiplier_str + power.bonus_str;
			const CD_PRE_MULT  = cd  + AP_MULTIPLIER * power.multiplier_cd  + power.bonus_cd;
	
			const C0 = str_mult * STR_PRE_MULT + 100; // 100 + FINAL_STR at k_str = 0
			const D0 = cd_mult  * CD_PRE_MULT  + 100; // 100 + FINAL_CD  at k_cd  = 0

			let k_str_low  = 0;
			let k_str_high = tp;

			// S > 0  <=>  k_str > -C0/str_mult
			// this is needed, okay?? what if you somehow have 3000 ap but is sb lv 30?? you would get negative strength with bizarre!!
			const negC0_over_str_mult = -C0 * INV_STR_MULT;
			if (negC0_over_str_mult >= 0) {
			 	const bound = Math.floor(negC0_over_str_mult) + 1;
			 	if (bound > k_str_low) k_str_low = bound;
			}
	
			// S · D0 ≤ Q_high  (when D0 > 0)
			if (D0 > 0) {
				const bound = Math.floor((Q_high / D0 - C0) * INV_STR_MULT);
				if (bound < k_str_high) k_str_high = bound;
			}
	
			if (k_str_low > k_str_high) continue;
	
			// yay middle school math
			// Q_low ≤ S · (H − cd_mult·k_str)
			//   →  −str_mult·cd_mult·k² + (str_mult·H − C0·cd_mult)·k + (C0·H − Q_low) ≥ 0
			const H = D0 + cd_mult * tp;
			const a = -str_mult * cd_mult;
			const b = str_mult * H - C0 * cd_mult;
			const disc = b * b - 4 * a * (C0 * H - Q_low);
			if (disc < 0) continue;
	
			// I DIDNT WANT TO INVERT AND DO MULTIPLY THE INVERSE BUT SOMEHOW THIS IS 30% FASTER ITS NOT EVEN IN A LOOP LIKE HELLO??
			const sqrt_disc = Math.sqrt(disc);
			const inv_2a = 0.5 / a;
			const r1 = (-b - sqrt_disc) * inv_2a;
			const r2 = (-b + sqrt_disc) * inv_2a;

			k_str_low  = Math.max(Math.ceil(Math.min(r1, r2)), k_str_low);
			k_str_high = Math.min(Math.floor(Math.max(r1, r2)), k_str_high);

			if (k_str_low > k_str_high) continue;
	
			const Ql_cd  = Q_low  * INV_CD_MULT;
			const Qh_cd  = Q_high * INV_CD_MULT;
			const offset = 100 * INV_CD_MULT + CD_PRE_MULT;

			// todo: fix ugly without making it slower
			// yes its never getting fixed :pensive:
			// #reasonsidontlikeprogramming
			for (let k_str = k_str_low, S = C0 + str_mult * k_str_low; k_str <= k_str_high; ++k_str, S += str_mult) {
				const INV_S = 1 / S;
				const k_cd = Math.max(0, Math.ceil(Ql_cd * INV_S - offset));

				if (k_cd > Math.min(Math.floor(Qh_cd * INV_S - offset), tp - k_str)) continue;

				const fd = dmg_per_S_CD * S * (D0 + cd_mult * k_cd);
				if (fd >= desired_damage && fd <= TARGET_HI) {
					results.push({ name: power.name, str_tuning: k_str, cd_tuning: k_cd }); break;
				}
			}
		}

		console.log(str, cd, str_mult, cd_mult, dmg_bonus, ap, tp, damage, desired_damage, results);

		return results;
	}
}


// wiring
preview_image.addEventListener("click", () => !mobile() && open_lightbox());
preview_close.addEventListener("click", (e) => { close_dialog(); e.stopPropagation(); });
backdrop.addEventListener("click", close_dialog);
lightbox.addEventListener("click", close_lightbox);

mq.addEventListener("change", () => { close_dialog(); close_lightbox();});
[...$("#toggle_rows").children, ...$("#input_rows").children].forEach(
	(row) => 
		(row.querySelector(".label") || row.querySelector("label")).addEventListener("click", () => show_preview(row.querySelector("label").htmlFor))
);

{
	const force_integer = (e) => e.addEventListener("input", () => {
		e.value = e.value.replace(/[^\d]/g, "");
	});

	const force_decimal = (e) => e.addEventListener("input", () => {
		e.value = e.value.replace(/[^\d.]/g, "")
			.match(/^\d*\.?\d*/)[0]
			.replace(/^0+(?=\d)/, "")
			.replace(/^\./, "0.");
	});

	$fn(".input_element_integer", force_integer);
	$fn(".input_element_number", force_decimal);
}

{
	const base_strength = $("#base_strength");
	const percentage_strength = $("#percentage_strength");
	const base_crit_damage = $("#base_crit_damage");
	const percentage_crit_damage = $("#percentage_crit_damage");
	const percentage_damage_bonus = $("#percentage_damage_bonus");
	const accessory_power = $("#accessory_power");
	const tuning_points = $("#tuning_points");
	const damage = $("#damage");
	const final_damage = $("#final_damage");
	const has_radio = $("#has_radio");

	const on_change = () => render_solutions(solve(
		+base_strength.value,
		+base_crit_damage.value,			 
		+percentage_strength.value / 100 + 1, 
		+percentage_crit_damage.value / 100 + 1, 
		+percentage_damage_bonus.value / 100, 
		+accessory_power.value,
		+tuning_points.value, 
		+damage.value + (has_radio.checked * $("input[name='bt_ring']:checked").value), 
		+final_damage.value,
	));

	[
		base_strength, 
		percentage_strength, 
		base_crit_damage, 
		percentage_crit_damage, 
		percentage_damage_bonus, 
		accessory_power, 
		tuning_points, 
		damage,
		final_damage,
		has_radio,
		$("#bt_ring_no"),
		$("#bt_ring_t1"),
		$("#bt_ring_t2"),
	].forEach((e) => e.addEventListener("change", on_change));

	final_damage.addEventListener("change", () => render_damage_splash(final_damage.value));
}

function update() {
	$("#final_damage").dispatchEvent(new Event("change"));
}

/** FOR TESTING
render_damage_splash(333333);

setTimeout(() => {
	render_solutions(solve(1355.25, 667, 1.0675, 1.0175, 5, 2206, 300, 662, 676767));
}, 1100)
*/