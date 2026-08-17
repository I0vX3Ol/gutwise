#!/usr/bin/env node
/**
 * Generates the lead magnet: the Low-FODMAP Elimination Phase Starter Kit PDF.
 *
 * Every CTA on the site promises this document, so it is a build artefact
 * rather than something to remember to make by hand. Regenerating it after a
 * content change keeps the PDF and the site from drifting apart.
 *
 * Typeset with pdfkit's base-14 fonts (Helvetica/Times), which are embedded in
 * every PDF reader — so the output is byte-reproducible on any machine and no
 * font licensing question arises. Helvetica is a close stand-in for Inter.
 *
 * Run: npm run kit
 */

import PDFDocument from 'pdfkit';
import { createWriteStream, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'downloads');
mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, 'gutwise-low-fodmap-starter-kit.pdf');

// Mirrors src/styles/global.css. Text colours here are the AA-verified tokens.
const C = {
	cream: '#FAF7F2',
	creamSunken: '#F2EDE4',
	border: '#E3DBCD',
	ink: '#241F1A',
	inkMuted: '#514A42',
	sageDeep: '#2F4A3C',
	sage: '#4C7361',
	sageLight: '#7FA88F',
	sageWash: '#E8F0EA',
	amber: '#7A5312',
	amberWash: '#FBF0DC',
	white: '#FFFFFF',
};

const PAGE = { width: 595.28, height: 841.89 }; // A4 portrait, in points
const M = 56; // margin
const CONTENT_W = PAGE.width - M * 2;

const doc = new PDFDocument({
	size: 'A4',
	margins: { top: M, bottom: M, left: M, right: M },
	bufferPages: true,
	info: {
		Title: 'Low-FODMAP Elimination Phase Starter Kit',
		Author: 'GutWise',
		Subject:
			'A practical starter kit for the elimination phase of the low-FODMAP diet',
		Keywords: 'low FODMAP, IBS, elimination phase, meal plan, symptom tracker',
		CreationDate: new Date(),
	},
	// Tagged PDF + language give screen readers a fighting chance at the
	// document; PDFs are far worse than HTML for accessibility, which is why
	// every fact in here also exists on the site itself.
	pdfVersion: '1.7',
	tagged: true,
	displayTitle: true,
	lang: 'en-GB',
});

doc.pipe(createWriteStream(outPath));

let pageNumber = 0;

/** Cream page background with the sage spine, drawn before any content. */
function paintPage({ dark = false } = {}) {
	doc
		.save()
		.rect(0, 0, PAGE.width, PAGE.height)
		.fill(dark ? C.sageDeep : C.cream)
		.rect(0, 0, 10, PAGE.height)
		.fill(dark ? C.sageLight : C.sageDeep)
		.restore();
}

/**
 * Bottom of the usable content area. Anything drawn past this either overflows
 * onto a new page or crowds the footer.
 */
const CONTENT_BOTTOM = PAGE.height - M;

/** Records how full each page ended up, for the DEBUG_LAYOUT report. */
const fillLevels = [];

function newPage({ dark = false } = {}) {
	if (pageNumber > 0) fillLevels.push({ page: pageNumber, endY: doc.y });
	doc.addPage();
	pageNumber++;
	paintPage({ dark });
	doc.y = M;
}

function heading(text, { size = 22, color = C.sageDeep, gap = 10 } = {}) {
	doc
		.font('Helvetica-Bold')
		.fontSize(size)
		.fillColor(color)
		.text(text, M, doc.y, { width: CONTENT_W });
	doc.moveDown(gap / 20);
}

function subheading(text, { color = C.sage } = {}) {
	doc.moveDown(0.5);
	doc
		.font('Helvetica-Bold')
		.fontSize(12)
		.fillColor(color)
		.text(text.toUpperCase(), M, doc.y, { width: CONTENT_W, characterSpacing: 1 });
	doc.moveDown(0.35);
}

function body(text, { color = C.ink, size = 10.5, gap = 0.6, indent = 0 } = {}) {
	doc
		.font('Helvetica')
		.fontSize(size)
		.fillColor(color)
		.text(text, M + indent, doc.y, {
			width: CONTENT_W - indent,
			align: 'left',
			lineGap: 2.5,
		});
	doc.moveDown(gap);
}

function bullets(items, { color = C.ink, marker = '•' } = {}) {
	for (const item of items) {
		const y = doc.y;
		doc.font('Helvetica-Bold').fontSize(10.5).fillColor(C.sage).text(marker, M + 4, y, {
			width: 12,
		});
		doc
			.font('Helvetica')
			.fontSize(10.5)
			.fillColor(color)
			.text(item, M + 20, y, { width: CONTENT_W - 20, lineGap: 2.5 });
		doc.moveDown(0.35);
	}
	doc.moveDown(0.3);
}

/** Tinted callout box that grows to fit its text. */
function callout(title, text, { tint = C.sageWash, textColor = C.sageDeep } = {}) {
	const padding = 12;
	doc.font('Helvetica-Bold').fontSize(11);
	const titleH = doc.heightOfString(title, { width: CONTENT_W - padding * 2 });
	doc.font('Helvetica').fontSize(10);
	const textH = doc.heightOfString(text, {
		width: CONTENT_W - padding * 2,
		lineGap: 2.5,
	});
	const boxH = titleH + textH + padding * 2 + 6;

	const top = doc.y;
	doc.save().roundedRect(M, top, CONTENT_W, boxH, 6).fill(tint).restore();

	doc
		.font('Helvetica-Bold')
		.fontSize(11)
		.fillColor(textColor)
		.text(title, M + padding, top + padding, { width: CONTENT_W - padding * 2 });
	doc
		.font('Helvetica')
		.fontSize(10)
		.fillColor(C.ink)
		.text(text, M + padding, doc.y + 4, {
			width: CONTENT_W - padding * 2,
			lineGap: 2.5,
		});

	doc.y = top + boxH + 14;
}

/**
 * Simple table. `widths` are fractions of the content width.
 */
function table(headers, rows, widths, { headerFill = C.sageDeep } = {}) {
	const colW = widths.map((w) => w * CONTENT_W);
	const rowPad = 6;

	// Header
	const hTop = doc.y;
	doc.font('Helvetica-Bold').fontSize(9.5);
	const hH =
		Math.max(
			...headers.map((h, i) =>
				doc.heightOfString(h, { width: colW[i] - rowPad * 2 }),
			),
		) +
		rowPad * 2;

	doc.save().rect(M, hTop, CONTENT_W, hH).fill(headerFill).restore();

	let x = M;
	headers.forEach((h, i) => {
		doc
			.fillColor(C.white)
			.text(h, x + rowPad, hTop + rowPad, { width: colW[i] - rowPad * 2 });
		x += colW[i];
	});
	doc.y = hTop + hH;

	// Rows
	doc.font('Helvetica').fontSize(9.5);
	rows.forEach((row, ri) => {
		const rTop = doc.y;
		const rH =
			Math.max(
				...row.map((cell, i) =>
					doc.heightOfString(String(cell), { width: colW[i] - rowPad * 2 }),
				),
			) +
			rowPad * 2;

		if (ri % 2 === 0) {
			doc.save().rect(M, rTop, CONTENT_W, rH).fill(C.creamSunken).restore();
		}

		x = M;
		row.forEach((cell, i) => {
			doc
				.fillColor(C.ink)
				.font('Helvetica')
				.fontSize(9.5)
				.text(String(cell), x + rowPad, rTop + rowPad, {
					width: colW[i] - rowPad * 2,
				});
			x += colW[i];
		});

		doc
			.save()
			.moveTo(M, rTop + rH)
			.lineTo(M + CONTENT_W, rTop + rH)
			.lineWidth(0.5)
			.stroke(C.border)
			.restore();

		doc.y = rTop + rH;
	});

	doc.moveDown(1);
}

/** Two-column list of foods, used for the safe-foods pages. */
function twoColList(title, items) {
	subheading(title);
	const colW = (CONTENT_W - 20) / 2;
	const half = Math.ceil(items.length / 2);
	const startY = doc.y;
	let maxY = startY;

	[items.slice(0, half), items.slice(half)].forEach((col, ci) => {
		doc.y = startY;
		const x = M + ci * (colW + 20);
		for (const item of col) {
			const y = doc.y;
			doc.font('Helvetica-Bold').fontSize(9.5).fillColor(C.sage).text('·', x, y, {
				width: 8,
			});
			doc
				.font('Helvetica')
				.fontSize(9.5)
				.fillColor(C.ink)
				.text(item, x + 10, y, { width: colW - 10, lineGap: 2 });
			doc.moveDown(0.2);
		}
		maxY = Math.max(maxY, doc.y);
	});

	doc.y = maxY;
	doc.moveDown(0.6);
}

// ---------------------------------------------------------------------------
// Page 1 — Cover
// ---------------------------------------------------------------------------
paintPage({ dark: true });
pageNumber = 1;

doc.y = 150;
doc
	.font('Helvetica-Bold')
	.fontSize(13)
	.fillColor(C.sageLight)
	.text('GUTWISE', M, doc.y, { characterSpacing: 3 });

doc.moveDown(1.6);
doc
	.font('Helvetica-Bold')
	.fontSize(38)
	.fillColor(C.cream)
	.text('Low-FODMAP\nElimination Phase\nStarter Kit', M, doc.y, {
		width: CONTENT_W,
		lineGap: 6,
	});

doc.moveDown(1.2);
doc
	.font('Helvetica')
	.fontSize(13)
	.fillColor(C.sageWash)
	.text(
		'Everything you need for the first six weeks — the safe-foods list, a two-week meal plan, a printable symptom tracker and a shopping checklist.',
		M,
		doc.y,
		{ width: CONTENT_W - 60, lineGap: 4 },
	);

doc.y = PAGE.height - 150;
doc
	.save()
	.moveTo(M, doc.y)
	.lineTo(M + 90, doc.y)
	.lineWidth(3)
	.stroke(C.sageLight)
	.restore();

doc.y += 18;
doc
	.font('Helvetica')
	.fontSize(10)
	.fillColor(C.sageWash)
	.text('gutwise.nexudel.com', M, doc.y);
doc
	.font('Helvetica')
	.fontSize(9)
	.fillColor(C.sageLight)
	.text(
		'Educational information, not medical advice. See the final page.',
		M,
		doc.y + 4,
	);

// ---------------------------------------------------------------------------
// Page 2 — How to use this kit
// ---------------------------------------------------------------------------
newPage();
heading('How to use this kit');
body(
	'This kit covers the elimination phase — the first of three phases, lasting two to six weeks. Its only job is to answer one question: do FODMAPs drive your symptoms at all?',
	{ color: C.inkMuted },
);

callout(
	'Before you start, please read this',
	'Get a formal diagnosis first. Coeliac disease, inflammatory bowel disease, bile acid malabsorption and several other conditions produce overlapping symptoms and need entirely different treatment — and coeliac screening is unreliable once you have already cut out wheat. If you can, work with a FODMAP-trained dietitian. It is the single change that most improves the odds of finishing with a broad diet.',
	{ tint: C.amberWash, textColor: C.amber },
);

subheading('What is inside');
table(
	['Page', 'Section', 'What it is for'],
	[
		['3', 'The five FODMAP groups', 'What you are actually removing, and why'],
		['4–5', 'Safe foods list', 'What you can eat freely, by category'],
		['6', 'Foods to avoid', 'The high-FODMAP list, grouped by type'],
		['7', 'Hidden FODMAPs', 'The eight places an elimination usually fails'],
		['8–9', 'Two-week meal plan', 'Fourteen days, no decisions required'],
		['10', 'Shopping checklist', 'Take this to the supermarket'],
		['11', 'Symptom tracker', 'Print one copy per week'],
		['12', 'Reading a label', 'How to scan an ingredients list quickly'],
		['13', 'What happens next', 'Reintroduction, and why you must not skip it'],
		['14', 'Disclaimer', 'The legal and medical small print'],
	],
	[0.12, 0.31, 0.57],
);

subheading('The three phases, in one paragraph');
body(
	'Elimination removes high-FODMAP foods across all five groups at once, for two to six weeks, until symptoms settle to a stable baseline. Reintroduction then challenges each group individually to find which ones you personally react to, and at what dose. Maintenance is the diet you land on afterwards: everything you tolerate, freely, with limits only where you found a genuine trigger. The goal is the broadest diet your gut allows — not the safest one you can imagine.',
);

// ---------------------------------------------------------------------------
// Page 3 — The five groups
// ---------------------------------------------------------------------------
newPage();
heading('The five FODMAP groups');
body(
	'FODMAP stands for Fermentable Oligosaccharides, Disaccharides, Monosaccharides And Polyols — short-chain carbohydrates the small intestine absorbs poorly. They draw water into the bowel and are fermented rapidly by gut bacteria, producing gas. In a gut with heightened pain signalling, that ordinary distension registers as pain and bloating.',
	{ color: C.inkMuted },
);

table(
	['Group', 'Found in', 'Common culprits'],
	[
		[
			'Fructans',
			'Wheat, rye, some vegetables, added fibres',
			'Onion, garlic, bread, pasta, inulin, chicory root',
		],
		[
			'GOS',
			'Legumes and some nuts',
			'Chickpeas, lentils, kidney beans, cashews, pistachios',
		],
		['Lactose', 'Dairy', 'Milk, soft cheese, yoghurt, ice cream, custard'],
		[
			'Excess fructose',
			'Some fruit and sweeteners',
			'Honey, apple, pear, mango, high-fructose corn syrup',
		],
		[
			'Polyols',
			'Stone fruit, some vegetables, sweeteners',
			'Peach, plum, mushroom, cauliflower, sorbitol, xylitol',
		],
	],
	[0.2, 0.33, 0.47],
);

callout(
	'The one idea to take from this page',
	'FODMAP content is a dose, not a property. Almost nothing is universally forbidden — most foods simply have a threshold. A quarter of an avocado is low FODMAP; half is not. FODMAPs also stack, so three portion-safe foods in one sitting can add up to a high-FODMAP meal. This is why every serving size in this kit is stated explicitly.',
);

body(
	'None of these carbohydrates is harmful. Most are prebiotics that feed beneficial bacteria, which is precisely why this diet is designed to be temporary rather than permanent.',
	{ color: C.inkMuted },
);

// ---------------------------------------------------------------------------
// Pages 4–5 — Safe foods
// ---------------------------------------------------------------------------
newPage();
heading('Safe foods (1 of 2)');
body(
	'Low FODMAP at the servings shown. Where no serving is given, the food has no meaningful ceiling at normal portions.',
	{ color: C.inkMuted },
);

twoColList('Protein — no FODMAPs at any portion', [
	'Chicken, turkey, beef, pork, lamb',
	'All fish and shellfish',
	'Eggs',
	'Firm tofu (170 g)',
	'Tempeh (100 g)',
	'Plain canned tuna and salmon',
]);

twoColList('Starches and grains', [
	'Rice — white, brown, jasmine, basmati',
	'Potato — no limit',
	'Quinoa — no practical limit',
	'Oats, rolled — 1/2 cup dry',
	'Polenta and cornmeal',
	'Gluten-free pasta — 1 cup cooked',
	'Sourdough spelt bread — 2 slices',
	'Rice noodles',
]);

twoColList('Vegetables', [
	'Carrot — no limit',
	'Cucumber — no limit',
	'Spinach — 75 g',
	'Lettuce, all types',
	'Courgette / zucchini — 65 g',
	'Green beans — 15 beans',
	'Bell pepper, red — 43 g',
	'Bok choy — 1 cup (75 g)',
	'Aubergine / eggplant — 75 g',
	'Tomato — 1 medium',
	'Potato, sweet — 75 g',
	'Spring onion, green tops only',
]);

newPage();
heading('Safe foods (2 of 2)');

twoColList('Fruit', [
	'Strawberries — no practical limit',
	'Blueberries — 20 berries',
	'Kiwi — 2 small',
	'Orange — 1 medium',
	'Banana, firm/unripe — 1 medium',
	'Grapes — 1 cup',
	'Pineapple — 1 cup',
	'Cantaloupe melon — 3/4 cup',
	'Raspberries — 30 g',
	'Rhubarb — 1 cup',
]);

twoColList('Dairy and alternatives', [
	'Lactose-free milk and yoghurt',
	'Cheddar, parmesan, swiss — aged hard cheeses',
	'Brie and camembert — 40 g',
	'Feta — 40 g',
	'Almond milk — 1 cup',
	'Macadamia milk — 1 cup',
	'Butter',
	'Lactose-free cream',
]);

twoColList('Nuts, seeds and fats', [
	'Walnuts — 30 g',
	'Almonds — 10 nuts',
	'Peanuts and peanut butter — 2 tbsp',
	'Macadamias — 20 nuts',
	'Pumpkin seeds — 2 tbsp',
	'Chia seeds — 2 tbsp',
	'Olive oil, all plain oils',
	'Garlic-infused oil — the key ingredient',
]);

twoColList('Flavour — where the diet is won', [
	'All fresh and dried herbs',
	'Ginger — no limit',
	'Turmeric, cumin, paprika, chilli',
	'Lemon and lime juice',
	'Soy sauce / tamari — 2 tbsp',
	'Maple syrup — 2 tbsp',
	'Sugar (sucrose)',
	'Vinegars — red wine, white, rice',
	'Asafoetida — 1/4 tsp, a garlic stand-in',
	'Chives and spring onion greens',
]);

// ---------------------------------------------------------------------------
// Page 6 — Foods to avoid
// ---------------------------------------------------------------------------
newPage();
heading('Foods to avoid during elimination');
body(
	'These are high FODMAP at normal servings. Avoiding them is temporary — most will come back during reintroduction, and most people find they tolerate the majority.',
	{ color: C.inkMuted },
);

table(
	['Category', 'Avoid for now'],
	[
		[
			'Vegetables',
			'Onion (all types), garlic, cauliflower, mushroom, asparagus, artichoke, leek bulb, sugar snap peas, celery (>5 cm)',
		],
		[
			'Fruit',
			'Apple, pear, mango, watermelon, peach, plum, nectarine, cherry, apricot, blackberry, dried fruit of any kind',
		],
		[
			'Grains',
			'Wheat bread, wheat pasta, couscous, rye, barley, most breakfast cereals, anything with added inulin or chicory root',
		],
		[
			'Legumes',
			'Chickpeas, lentils (>1/4 cup), kidney beans, baked beans, black beans, soy beans, silken tofu',
		],
		[
			'Dairy',
			'Regular milk, soft and cream cheeses, yoghurt, ice cream, custard, condensed and evaporated milk',
		],
		[
			'Nuts',
			'Cashews and pistachios — these two are notably high in GOS',
		],
		[
			'Sweeteners',
			'Honey, agave, high-fructose corn syrup, and anything ending in -ol: sorbitol, mannitol, xylitol, maltitol, isomalt',
		],
		[
			'Drinks',
			'Apple and pear juice, chai, chamomile and fennel tea, rum, sweetened soft drinks',
		],
	],
	[0.22, 0.78],
);

callout(
	'A note on tone',
	'This is a list of foods to set aside for a few weeks, not a list of dangerous things. Nothing here will damage you, and treating the list as a minefield tends to make people more restricted rather than better informed. If you eat something on it, you may have symptoms for a day — then you carry on. There is no need to restart the clock.',
);

// ---------------------------------------------------------------------------
// Page 7 — Hidden FODMAPs
// ---------------------------------------------------------------------------
newPage();
heading('The eight places an elimination usually fails');
body(
	'When someone reports that the diet "did nothing", the cause is almost always on this list rather than a genuine non-response. Check every one of these in week one.',
	{ color: C.inkMuted },
);

bullets([
	'Stock cubes and liquid stock — the single most common culprit. Onion and garlic appear as "natural flavouring" or "vegetable extract" rather than being named.',
	'Pre-marinated or basted meat — supermarket chicken is very often seasoned with garlic before you buy it.',
	'"High-fibre" and "gut-healthy" products — inulin and chicory root fibre are concentrated fructans, and they are added to exactly the products marketed as good for digestion.',
	'Protein powders and bars — frequently sweetened with sorbitol, xylitol or high-fructose corn syrup.',
	'Sugar-free gum and mints — polyols, often several servings a day without anyone counting them.',
	'Salad dressings and mayonnaise — garlic powder is close to universal.',
	'Curry pastes, stir-fry sauces and gravy — assume these contain allium unless the label proves otherwise.',
	'Oat milk poured over oats — a good low-FODMAP choice in coffee, but it stacks with the oats themselves.',
]);

callout(
	'The fix for most of this',
	'Buy one stock certified by Monash or FODMAP Friendly, and one bottle of commercially prepared garlic-infused oil. Those two purchases remove more accidental exposure than anything else you can do. Do not infuse garlic oil yourself and store it — garlic in oil is a low-oxygen environment that can support Clostridium botulinum.',
	{ tint: C.amberWash, textColor: C.amber },
);

// ---------------------------------------------------------------------------
// Pages 8–9 — Meal plan
// ---------------------------------------------------------------------------
newPage();
heading('Two-week meal plan — week 1');
body(
	'Deliberately repetitive. Week one is cognitively demanding, and reducing the number of daily decisions matters more than variety. Every meal here is low FODMAP at one serving.',
	{ color: C.inkMuted },
);

table(
	['Day', 'Breakfast', 'Lunch', 'Dinner'],
	[
		['Mon', 'Overnight oats, strawberries', 'Quinoa bowl, feta, cucumber', 'Lemon herb chicken, potatoes'],
		['Tue', 'Overnight oats, strawberries', 'Leftover chicken, spinach', 'Tomato basil pasta (GF)'],
		['Wed', 'Eggs, sourdough spelt toast', 'Quinoa bowl, tinned tuna', 'Ginger carrot soup, rice'],
		['Thu', 'Overnight oats, blueberries', 'Leftover soup', 'Sheet-pan salmon, bok choy, rice'],
		['Fri', 'Eggs, tomato, chives', 'Quinoa bowl, chicken', 'Tomato basil pasta (GF)'],
		['Sat', 'Lactose-free yoghurt, walnuts', 'Omelette, cheddar, spinach', 'Lemon herb chicken, potatoes'],
		['Sun', 'Eggs, sourdough spelt toast', 'Leftover chicken salad', 'Roast beef, carrots, rice'],
	],
	[0.1, 0.3, 0.3, 0.3],
);

subheading('Snacks, any day');
bullets([
	'Three peanut butter and oat energy bites',
	'A firm banana, or ten strawberries',
	'A small handful of walnuts (30 g) or almonds (10 nuts)',
	'Rice cakes with peanut butter (2 tbsp)',
	'40 g cheddar with a few gluten-free crackers',
]);

newPage();
heading('Two-week meal plan — week 2');
body(
	'By now the basics are automatic, so week two adds a little more variety. Keep tracking symptoms daily — you are looking for a trend across the fortnight, not a verdict on any single day.',
	{ color: C.inkMuted },
);

table(
	['Day', 'Breakfast', 'Lunch', 'Dinner'],
	[
		['Mon', 'Overnight oats, kiwi', 'Quinoa bowl, olives, feta', 'Sheet-pan salmon, rice'],
		['Tue', 'Eggs, spinach, chives', 'Leftover salmon, cucumber', 'Beef stir-fry, rice, ginger'],
		['Wed', 'Lactose-free yoghurt, berries', 'Jacket potato, cheddar, tuna', 'Ginger carrot soup, spelt toast'],
		['Thu', 'Overnight oats, strawberries', 'Leftover stir-fry', 'Lemon herb chicken, potatoes'],
		['Fri', 'Eggs, sourdough spelt toast', 'Quinoa bowl, chicken', 'Tomato basil pasta, parmesan'],
		['Sat', 'Oats, maple syrup, walnuts', 'Omelette, tomato, feta', 'Roast pork, potatoes, green beans'],
		['Sun', 'Eggs, tomato, spelt toast', 'Leftover roast, salad', 'Prawn rice noodles, bok choy'],
	],
	[0.1, 0.3, 0.3, 0.3],
);

callout(
	'Cooking rules that make all of this work',
	'Use garlic-infused oil as your default cooking fat. Use spring onion greens wherever a recipe says onion. Season with herbs, ginger, lemon, soy sauce and plenty of salt and pepper. Use certified stock, or plain water plus more seasoning. That is genuinely the whole technique.',
);

// ---------------------------------------------------------------------------
// Page 10 — Shopping checklist
// ---------------------------------------------------------------------------
newPage();
heading('Shopping checklist');
body('Covers roughly one week for one person. Tick as you go.', {
	color: C.inkMuted,
});

/** Checklist with an empty square to tick. */
function checklist(title, items) {
	subheading(title);
	const colW = (CONTENT_W - 20) / 2;
	const half = Math.ceil(items.length / 2);
	const startY = doc.y;
	let maxY = startY;

	[items.slice(0, half), items.slice(half)].forEach((col, ci) => {
		doc.y = startY;
		const x = M + ci * (colW + 20);
		for (const item of col) {
			const y = doc.y;
			doc.save().roundedRect(x, y + 1, 8.5, 8.5, 1.5).lineWidth(0.8).stroke(C.sage).restore();
			doc
				.font('Helvetica')
				.fontSize(9.5)
				.fillColor(C.ink)
				.text(item, x + 15, y, { width: colW - 15, lineGap: 2 });
			doc.moveDown(0.25);
		}
		maxY = Math.max(maxY, doc.y);
	});

	doc.y = maxY;
	doc.moveDown(0.5);
}

checklist('Buy these first — they do the heavy lifting', [
	'Garlic-infused olive oil (certified)',
	'Certified low-FODMAP stock',
	'Lactose-free milk',
	'The Monash University FODMAP app',
]);

checklist('Fresh', [
	'Chicken thighs',
	'Salmon fillets',
	'Beef or pork',
	'Eggs',
	'Carrots',
	'Potatoes',
	'Cucumber',
	'Spinach',
	'Cherry tomatoes',
	'Bok choy',
	'Courgette',
	'Green beans',
	'Strawberries',
	'Blueberries',
	'Firm bananas',
	'Oranges',
	'Spring onions',
	'Fresh ginger',
	'Lemons',
	'Parsley and basil',
]);

checklist('Store cupboard', [
	'Jasmine or basmati rice',
	'Quinoa',
	'Rolled oats',
	'Gluten-free pasta',
	'Rice noodles',
	'Canned chopped tomatoes',
	'Tomato paste',
	'Canned tuna',
	'Peanut butter (no honey)',
	'Maple syrup',
	'Chia seeds',
	'Walnuts',
	'Soy sauce or tamari',
	'Sesame oil',
	'Olive oil',
	'Dried oregano and cumin',
]);

checklist('Chilled', [
	'Lactose-free yoghurt',
	'Cheddar',
	'Parmesan',
	'Feta',
	'Butter',
	'Sourdough spelt bread',
]);

// ---------------------------------------------------------------------------
// Page 11 — Symptom tracker
// ---------------------------------------------------------------------------
newPage();
heading('Weekly symptom tracker');
body(
	'Print one copy per week. Recall across six weeks is genuinely unreliable — without a written record you will finish the phase unable to say clearly whether it worked. Score each symptom 0 (none) to 10 (worst). Track sleep and stress too: both move IBS symptoms independently of food, and without those columns you will misattribute a bad week.',
	{ color: C.inkMuted },
);

doc.moveDown(0.5);
table(
	['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
	[
		['Bloating (0–10)', '', '', '', '', '', '', ''],
		['Abdominal pain (0–10)', '', '', '', '', '', '', ''],
		['Wind (0–10)', '', '', '', '', '', '', ''],
		['Urgency (0–10)', '', '', '', '', '', '', ''],
		['Bowel habit (type 1–7)', '', '', '', '', '', '', ''],
		['Energy (0–10)', '', '', '', '', '', '', ''],
		['Sleep (hours)', '', '', '', '', '', '', ''],
		['Stress (0–10)', '', '', '', '', '', '', ''],
		['Anything off-plan?', '', '', '', '', '', '', ''],
	],
	[0.244, 0.108, 0.108, 0.108, 0.108, 0.108, 0.108, 0.108],
);

subheading('Notes for the week');
for (let i = 0; i < 6; i++) {
	doc
		.save()
		.moveTo(M, doc.y + 10)
		.lineTo(M + CONTENT_W, doc.y + 10)
		.lineWidth(0.5)
		.stroke(C.border)
		.restore();
	doc.y += 22;
}

// ---------------------------------------------------------------------------
// Page 12 — Reading a label
// ---------------------------------------------------------------------------
newPage();
heading('How to read a label in ten seconds');
body(
	'You do not need to understand the whole ingredients list. You are scanning for a short set of words, and they cluster near the top of the list where quantities are largest.',
	{ color: C.inkMuted },
);

subheading('Red-flag words — put it back');
bullets([
	'Onion, onion powder, shallot, garlic, garlic powder',
	'Inulin, chicory root, chicory root fibre, FOS, oligofructose',
	'Honey, agave, high-fructose corn syrup, fruit juice concentrate',
	'Anything ending in -ol: sorbitol, mannitol, xylitol, maltitol, isomalt',
	'Wheat flour, rye, barley, malt extract',
	'Milk solids, whey powder, milk powder',
	'"Natural flavouring" or "vegetable extract" in a savoury product — this is where allium usually hides',
]);

subheading('Green-flag words — usually fine');
bullets([
	'Rice flour, corn flour, potato starch, tapioca',
	'Cane sugar, sucrose, glucose, dextrose, maple syrup',
	'Lactose-free milk, aged cheeses',
	'Garlic-infused oil (as distinct from garlic)',
	'Herbs, spices, salt, vinegar, citric acid',
]);

callout(
	'When the label is genuinely ambiguous',
	'Check the Monash app first. If the product is not listed and the ingredients are unclear, leave it for now and revisit during reintroduction — a single unknown is not worth risking a muddy result in the one phase that is meant to give you a clean answer.',
);

// ---------------------------------------------------------------------------
// Page 13 — What happens next
// ---------------------------------------------------------------------------
newPage();
heading('What happens next');
body(
	'The elimination phase ends. That is the part most people are not told clearly enough, and it is the single most consequential thing in this document.',
	{ color: C.inkMuted },
);

subheading('If your symptoms improved');
body(
	'Hold the baseline for another week or two to be confident, then move to reintroduction. Do not linger in elimination because it feels safe — lingering is the most common mistake in the entire protocol. Elimination tells you only that FODMAPs matter. It does not tell you which ones, and that is the piece of information that actually changes your diet.',
);

subheading('If nothing changed after six weeks');
body(
	'Stop, and go back to your clinician. Continuing has no further diagnostic value. Roughly a quarter of people with IBS do not respond to this diet, and small intestinal bacterial overgrowth, bile acid malabsorption, coeliac disease, endometriosis and pelvic floor dysfunction all mimic IBS while needing entirely different treatment. Before you conclude anything, re-check the hidden-FODMAP list on page 7 — an overlooked stock cube invalidates the whole experiment.',
);

callout(
	'What success actually looks like',
	'Not "I found the foods I can eat." Success is finishing all three phases eating a wide, varied, socially normal diet in which you limit two or three specific things and know exactly why. Most people who complete reintroduction properly discover they react to only one or two groups and tolerate the rest without difficulty. Long-term blanket restriction measurably reduces gut microbiome diversity — the elimination phase is scaffolding, and scaffolding comes down.',
);

body(
	'The full reintroduction protocol — which test food to use for each group, the three-day dosing schedule, washout periods and how to read ambiguous results — is on the site at gutwise.nexudel.com/guides/reintroduction-protocol/',
	{ color: C.sage },
);

// ---------------------------------------------------------------------------
// Page 14 — Disclaimer
// ---------------------------------------------------------------------------
newPage();
heading('Important information');

subheading('Medical disclaimer');
body(
	'GutWise publishes educational information, not medical advice. This document is not a substitute for personalised assessment, diagnosis or treatment by a qualified healthcare professional, and no clinician-patient relationship is created by reading it.',
);
body(
	'The low-FODMAP diet is an elimination protocol intended to be followed short-term with support from a registered dietitian. It is not a weight-loss diet and should not be used as one — doing so carries a documented risk of disordered eating in this population. It is not appropriate for everyone, and it is not appropriate for anyone who has not first been formally assessed.',
);
body(
	'Always speak to a qualified healthcare professional before changing your diet, particularly if you have not been formally diagnosed, are pregnant or breastfeeding, have a history of disordered eating, or are managing another medical condition.',
);
body(
	'Seek prompt medical attention for any of the following, which are not features of IBS: unintentional weight loss, blood in your stool, fever, persistent vomiting, difficulty swallowing, anaemia, symptoms that wake you at night, or a first onset of symptoms after age 50.',
	{ color: C.amber },
);

subheading('About the serving sizes');
body(
	'Portion thresholds reflect published Monash University laboratory testing at the time of writing. FODMAP data is revised as new foods are analysed and as existing foods are re-tested, so the Monash University FODMAP app remains the authoritative and current source. Where this document and the app disagree, follow the app.',
);

subheading('Copyright');
body(
	`© ${new Date().getFullYear()} GutWise. This kit is provided free for personal use. You are welcome to print it and share the download link. Please do not redistribute the file itself, republish the contents, or sell it.`,
);

doc.moveDown(1);
doc
	.save()
	.moveTo(M, doc.y)
	.lineTo(M + CONTENT_W, doc.y)
	.lineWidth(2)
	.stroke(C.sageLight)
	.restore();
doc.moveDown(1);

doc
	.font('Helvetica-Bold')
	.fontSize(12)
	.fillColor(C.sageDeep)
	.text('gutwise.nexudel.com', M, doc.y);
doc
	.font('Helvetica')
	.fontSize(10)
	.fillColor(C.inkMuted)
	.text(
		'Recipes with tested portion limits, phase-by-phase guides, and honest product picks.',
		M,
		doc.y + 4,
		{ width: CONTENT_W },
	);

// ---------------------------------------------------------------------------
// Footers — added last so every page gets one except the cover
// ---------------------------------------------------------------------------
fillLevels.push({ page: pageNumber, endY: doc.y });

// Layout report: pdfkit silently paginates on overflow, so the useful signal is
// how close each page came to the bottom. Run `DEBUG_LAYOUT=1 npm run kit`.
if (process.env.DEBUG_LAYOUT) {
	console.log(`\nPage fill (content bottom = ${CONTENT_BOTTOM.toFixed(0)}pt):`);
	for (const { page, endY } of fillLevels) {
		const pct = ((endY / CONTENT_BOTTOM) * 100).toFixed(0);
		const flag = endY > CONTENT_BOTTOM ? ' ← OVERFLOW' : endY > CONTENT_BOTTOM * 0.97 ? ' ← tight' : '';
		console.log(`  p${String(page).padStart(2)}  ${endY.toFixed(0).padStart(4)}pt  ${pct.padStart(3)}%${flag}`);
	}
	console.log('');
}

const range = doc.bufferedPageRange();
for (let i = range.start + 1; i < range.start + range.count; i++) {
	doc.switchToPage(i);

	// The footer sits below the bottom margin. pdfkit treats writing past the
	// margin as content overflow and helpfully starts a new page — which would
	// silently triple the document — so the margin is dropped for this write
	// and restored immediately after.
	const restoreBottom = doc.page.margins.bottom;
	doc.page.margins.bottom = 0;

	const y = PAGE.height - 38;
	doc
		.font('Helvetica')
		.fontSize(8.5)
		.fillColor(C.inkMuted)
		.text('GutWise — Low-FODMAP Elimination Phase Starter Kit', M, y, {
			width: CONTENT_W * 0.7,
			lineBreak: false,
		});
	doc
		.font('Helvetica-Bold')
		.fontSize(8.5)
		.fillColor(C.sage)
		.text(String(i + 1), M + CONTENT_W - 40, y, {
			width: 40,
			align: 'right',
			lineBreak: false,
		});

	doc.page.margins.bottom = restoreBottom;
}

// Re-read the range after the footer pass: if anything overflowed, pdfkit will
// have appended pages, and the count is the only cheap way to notice.
const finalCount = doc.bufferedPageRange().count;

doc.end();

const EXPECTED_PAGES = 14;
if (finalCount !== EXPECTED_PAGES) {
	console.error(
		`✗ Starter Kit is ${finalCount} pages, expected ${EXPECTED_PAGES}.\n` +
			'  Content has overflowed its page. Every CTA on the site calls this a\n' +
			'  14-page PDF, so either trim the content or update the copy.',
	);
	process.exit(1);
}

console.log(
	`✓ Generated ${finalCount}-page Starter Kit at public/downloads/gutwise-low-fodmap-starter-kit.pdf`,
);
