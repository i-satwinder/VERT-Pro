import { PDFDocument } from "pdf-lib";

/**
 * Get the number of pages in a PDF file.
 */
export async function getPdfPageCount(file: File): Promise<number> {
	const bytes = await file.arrayBuffer();
	const doc = await PDFDocument.load(bytes);
	return doc.getPageCount();
}

/**
 * Merge multiple PDF files into one.
 * Returns a Blob of the merged PDF.
 */
export async function mergePdfs(files: File[]): Promise<Blob> {
	if (files.length < 2) {
		throw new Error("At least two files are required to merge");
	}

	const mergedDoc = await PDFDocument.create();

	for (const file of files) {
		const bytes = await file.arrayBuffer();
		const srcDoc = await PDFDocument.load(bytes);
		const copiedPages = await mergedDoc.copyPages(
			srcDoc,
			srcDoc.getPageIndices(),
		);
		for (const page of copiedPages) {
			mergedDoc.addPage(page);
		}
	}

	const pdfBytes = await mergedDoc.save();
	return new Blob([pdfBytes], { type: "application/pdf" });
}

/**
 * Parse a page range string like "1-3,5,7-9" into an array of 0-based page indices.
 * Pages are 1-based in the input string.
 */
function parsePageRange(rangeStr: string, totalPages: number): number[] {
	const indices = new Set<number>();
	const parts = rangeStr.split(",").map((p) => p.trim());

	for (const part of parts) {
		if (part.includes("-")) {
			const [startStr, endStr] = part.split("-");
			const start = parseInt(startStr, 10);
			const end = parseInt(endStr, 10);
			if (isNaN(start) || isNaN(end)) continue;
			const clampedStart = Math.max(1, Math.min(start, totalPages));
			const clampedEnd = Math.max(1, Math.min(end, totalPages));
			const lo = Math.min(clampedStart, clampedEnd);
			const hi = Math.max(clampedStart, clampedEnd);
			for (let i = lo; i <= hi; i++) {
				indices.add(i - 1); // convert to 0-based
			}
		} else {
			const page = parseInt(part, 10);
			if (!isNaN(page) && page >= 1 && page <= totalPages) {
				indices.add(page - 1); // convert to 0-based
			}
		}
	}

	return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Split a PDF into multiple PDFs based on page ranges.
 * Returns an array of Blobs, one per range.
 */
export async function splitPdf(
	file: File,
	pageRanges: string[],
): Promise<Blob[]> {
	const bytes = await file.arrayBuffer();
	const srcDoc = await PDFDocument.load(bytes);
	const totalPages = srcDoc.getPageCount();

	const results: Blob[] = [];

	for (const range of pageRanges) {
		const indices = parsePageRange(range, totalPages);
		if (indices.length === 0) continue;

		const newDoc = await PDFDocument.create();
		const copiedPages = await newDoc.copyPages(srcDoc, indices);
		for (const page of copiedPages) {
			newDoc.addPage(page);
		}

		const pdfBytes = await newDoc.save();
		results.push(new Blob([pdfBytes], { type: "application/pdf" }));
	}

	return results;
}

/**
 * Compress a PDF by loading and re-saving it.
 * Optionally strips metadata.
 */
export async function compressPdf(
	file: File,
	stripMetadata = false,
): Promise<Blob> {
	const bytes = await file.arrayBuffer();
	const srcDoc = await PDFDocument.load(bytes, {
		ignoreEncryption: true,
	});

	if (stripMetadata) {
		srcDoc.setTitle("");
		srcDoc.setAuthor("");
		srcDoc.setSubject("");
		srcDoc.setKeywords([]);
		srcDoc.setProducer("");
		srcDoc.setCreator("");
	}

	// Remove metadata by setting fields to empty/defaults
	// pdf-lib's save() already does object compaction
	const pdfBytes = await srcDoc.save({
		useObjectStreams: true, // enables object streams for smaller output
		addDefaultPage: false,
	});

	return new Blob([pdfBytes], { type: "application/pdf" });
}
