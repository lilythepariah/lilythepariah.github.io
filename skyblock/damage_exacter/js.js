const $ = (selector) => document.querySelector(selector);
const $fn = (selector, fn) => document.querySelectorAll(selector).forEach(fn);

{
	const force_integer = (e) => e.addEventListener("input", () => {
		e.value = e.value.replace(/[^\d]/g, "");
	});

	const force_decimal = (e) => e.addEventListener("input", () => {
		e.value = e.value.replace(/[^\d.]/g, "")
			.match(/^\d*\.?\d*/)[0]
			.replace(/^0+(?=\d)/, "")
			.replace(/^\./, "0.");
	})

	$fn(".input_element_integer", force_integer);
	$fn(".input_element_number", force_decimal);
}

const mq = matchMedia("(max-width: 900px)");
const mobile = () => mq.matches;

const preview         = $("#preview");
const backdrop        = $("#backdrop");
const preview_image   = preview.querySelector("img");
const preview_caption = preview.querySelector(".caption");
const preview_close   = $("#preview_close");
const lightbox        = $("#lightbox");
const lightbox_image  = $("#lightbox_img");

let hints_data;

fetch('./hints.json')
	.then(response => {
		if (!response.ok)
			throw new Error(`HTTP error! Status: ${response.status}`);
		return response.json();
	})
	.then(data => { hints_data = data; });

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

function show_preview(item) {
	preview_image.src = `hints_img/${item}.webp`;

	let hint = hints_data[item];
	if (hint)
		preview_caption.innerHTML = `<h3>${hint.heading}</h3>${hint.paragraph || ""}`;

	if (mobile()) open_dialog();
}

for (const row of $("#input_rows").children)
	row.addEventListener("click", () => show_preview(row.querySelector("label").htmlFor));

preview_image.addEventListener("click", () => !mobile() && open_lightbox());
preview_close.addEventListener("click", (e) => { close_dialog(), e.stopPropagation() });
backdrop.addEventListener("click", close_dialog);
lightbox.addEventListener("click", close_lightbox); 
mq.addEventListener("change", () => { close_dialog(); close_lightbox();});