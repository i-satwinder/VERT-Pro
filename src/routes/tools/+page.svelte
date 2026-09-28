<script lang="ts">
	import Panel from "$lib/components/visual/Panel.svelte";
	import Tooltip from "$lib/components/visual/Tooltip.svelte";
	import { mergePdfs, splitPdf, compressPdf, getPdfPageCount } from "$lib/pdfUtils";
	import { effects } from "$lib/store/index.svelte";
	import { ToastManager } from "$lib/util/toast.svelte";
	import { log } from "$lib/util/logger";
	import {
		GitMergeIcon,
		ScissorsIcon,
		FileDownIcon,
		FileUpIcon,
		XIcon,
		GaugeIcon,
		ArrowUpIcon,
		ArrowDownIcon,
	} from "lucide-svelte";

	type ToolMode = "merge" | "split" | "compress";

	let activeMode = $state<ToolMode>("merge");

	// Merge state
	let mergeFiles = $state<File[]>([]);
	let mergeFilePageCounts = $state<Map<string, number>>(new Map());
	let mergeProcessing = $state(false);

	// Split state
	let splitFile = $state<File | null>(null);
	let splitPageCount = $state(0);
	let splitRanges = $state("");
	let splitProcessing = $state(false);

	// Compress state
	let compressFile = $state<File | null>(null);
	let compressOriginalSize = $state(0);
	let compressStripMetadata = $state(false);
	let compressProcessing = $state(false);

	// Refs
	let mergeInput = $state<HTMLInputElement>();
	let splitInput = $state<HTMLInputElement>();
	let compressInput = $state<HTMLInputElement>();

	// --- Merge handlers ---
	const handleMergeUpload = async (e: Event) => {
		const input = e.target as HTMLInputElement;
		if (!input.files?.length) return;
		const newFiles = Array.from(input.files).filter(
			(f) => f.type === "application/pdf",
		);
		if (newFiles.length !== input.files.length) {
			ToastManager.add({
				type: "warning",
				message: "Only PDF files are supported for merging.",
			});
		}
		for (const f of newFiles) {
			mergeFiles.push(f);
			try {
				const count = await getPdfPageCount(f);
				mergeFilePageCounts.set(f.name, count);
			} catch {
				mergeFilePageCounts.set(f.name, 0);
			}
		}
		input.value = "";
	};

	const removeMergeFile = (index: number) => {
		const removed = mergeFiles.splice(index, 1)[0];
		mergeFilePageCounts.delete(removed.name);
	};

	const moveMergeFile = (index: number, direction: -1 | 1) => {
		const newIndex = index + direction;
		if (newIndex < 0 || newIndex >= mergeFiles.length) return;
		const temp = mergeFiles[index];
		mergeFiles[index] = mergeFiles[newIndex];
		mergeFiles[newIndex] = temp;
	};

	const handleMerge = async () => {
		if (mergeFiles.length < 2) return;
		mergeProcessing = true;
		try {
			log(["tools", "merge"], `merging ${mergeFiles.length} PDFs`);
			const blob = await mergePdfs(mergeFiles);
			downloadBlob(blob, "merged.pdf");
			ToastManager.add({
				type: "success",
				message: `Successfully merged ${mergeFiles.length} PDFs.`,
			});
		} catch (err) {
			log(["tools", "merge"], `merge failed: ${err}`);
			ToastManager.add({
				type: "error",
				message: `Merge failed: ${err instanceof Error ? err.message : String(err)}`,
			});
		} finally {
			mergeProcessing = false;
		}
	};

	// --- Split handlers ---
	const handleSplitUpload = async (e: Event) => {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
			ToastManager.add({
				type: "warning",
				message: "Only PDF files are supported.",
			});
			return;
		}
		splitFile = file;
		splitRanges = "";
		try {
			splitPageCount = await getPdfPageCount(file);
		} catch {
			splitPageCount = 0;
			ToastManager.add({
				type: "error",
				message: "Could not read PDF. The file may be corrupted or encrypted.",
			});
		}
		input.value = "";
	};

	const handleSplit = async () => {
		if (!splitFile || !splitRanges.trim()) return;
		const ranges = splitRanges
			.split(";")
			.map((r) => r.trim())
			.filter(Boolean);
		if (ranges.length === 0) return;

		splitProcessing = true;
		try {
			log(["tools", "split"], `splitting PDF into ${ranges.length} parts`);
			const blobs = await splitPdf(splitFile, ranges);
			if (blobs.length === 1) {
				downloadBlob(blobs[0], "split.pdf");
			} else {
				// Download as a zip if multiple parts
				const { downloadZip } = await import("client-zip");
				const files = blobs.map((b, i) => ({
					name: `split_part_${i + 1}.pdf`,
					input: b,
				}));
				const zipBlob = await downloadZip(files, "split.zip").blob();
				downloadBlob(zipBlob, "split.zip");
			}
			ToastManager.add({
				type: "success",
				message: `Split into ${blobs.length} part(s).`,
			});
		} catch (err) {
			log(["tools", "split"], `split failed: ${err}`);
			ToastManager.add({
				type: "error",
				message: `Split failed: ${err instanceof Error ? err.message : String(err)}`,
			});
		} finally {
			splitProcessing = false;
		}
	};

	// --- Compress handlers ---
	const handleCompressUpload = async (e: Event) => {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		if (file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
			ToastManager.add({
				type: "warning",
				message: "Only PDF files are supported.",
			});
			return;
		}
		compressFile = file;
		compressOriginalSize = file.size;
		input.value = "";
	};

	const handleCompress = async () => {
		if (!compressFile) return;
		compressProcessing = true;
		try {
			log(["tools", "compress"], `compressing PDF: ${compressFile.name}`);
			const blob = await compressPdf(compressFile, compressStripMetadata);
			const originalSize = compressFile.size;
			const newSize = blob.size;
			const savedPercent =
				originalSize > 0
					? Math.round(((originalSize - newSize) / originalSize) * 100)
					: 0;

			downloadBlob(blob, `compressed_${compressFile.name}`);
			ToastManager.add({
				type: "success",
				message: `Compressed! Saved ${savedPercent}% (${formatBytes(originalSize)} → ${formatBytes(newSize)}).`,
			});
		} catch (err) {
			log(["tools", "compress"], `compress failed: ${err}`);
			ToastManager.add({
				type: "error",
				message: `Compress failed: ${err instanceof Error ? err.message : String(err)}`,
			});
		} finally {
			compressProcessing = false;
		}
	};

	// --- Helpers ---
	function downloadBlob(blob: Blob, filename: string) {
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.target = "_blank";
		a.style.display = "none";
		a.click();
		URL.revokeObjectURL(url);
		a.remove();
	}

	function formatBytes(bytes: number): string {
		if (bytes === 0) return "0 B";
		const k = 1024;
		const sizes = ["B", "KB", "MB", "GB"];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
	}

	const modes = [
		{ id: "merge" as ToolMode, label: "Merge", icon: GitMergeIcon },
		{ id: "split" as ToolMode, label: "Split", icon: ScissorsIcon },
		{ id: "compress" as ToolMode, label: "Compress", icon: GaugeIcon },
	];
</script>

<div class="flex flex-col justify-center items-center gap-8 -mt-4 px-4 md:p-0">
	<div class="max-w-[778px] w-full">
		<h1 class="text-4xl md:text-5xl text-center tracking-tight leading-tight mb-6">
			PDF Tools
		</h1>

		<!-- Mode selector -->
		<Panel class="flex gap-2 p-2">
			{#each modes as mode}
				<button
					class="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all duration-200 {activeMode ===
					mode.id
						? 'bg-accent text-on-accent'
						: 'hover:bg-panel-alt text-muted'}"
					onclick={() => (activeMode = mode.id)}
				>
					<mode.icon size="20" />
					<span>{mode.label}</span>
				</button>
			{/each}
		</Panel>
	</div>

	<!-- Merge Panel -->
	{#if activeMode === "merge"}
		<div class="max-w-[778px] w-full flex flex-col gap-4">
			<Panel class="flex flex-col gap-4 p-5">
				<div class="flex items-center justify-between">
					<h2 class="text-xl font-bold flex items-center gap-2">
						<GitMergeIcon size="24" class="text-accent" />
						Merge PDFs
					</h2>
					<Tooltip text="Upload PDF files to merge" position="left">
						<button
							class="btn {$effects ? '' : '!scale-100'} flex gap-2"
							onclick={() => mergeInput?.click()}
						>
							<FileUpIcon size="20" />
							Add Files
						</button>
					</Tooltip>
				</div>

				<input
					bind:this={mergeInput}
					type="file"
					accept=".pdf,application/pdf"
					multiple
					class="hidden"
					onchange={handleMergeUpload}
				/>

				{#if mergeFiles.length === 0}
					<div
						class="flex flex-col items-center justify-center py-12 text-muted"
					>
						<FileUpIcon size="48" class="mb-3 opacity-40" />
						<p class="text-lg font-medium">No files added</p>
						<p class="text-sm">Upload 2 or more PDFs to merge them into one</p>
					</div>
				{:else}
					<div class="flex flex-col gap-2">
						{#each mergeFiles as file, i (file.name + i)}
							<div
								class="flex items-center gap-3 bg-panel-alt rounded-xl px-4 py-3"
							>
								<div class="flex-1 min-w-0">
									<p class="font-medium truncate">{file.name}</p>
									<p class="text-sm text-muted">
										{formatBytes(file.size)}
										{#if mergeFilePageCounts.get(file.name)}
											· {mergeFilePageCounts.get(file.name)} pages
										{/if}
									</p>
								</div>
								<div class="flex gap-1">
									<button
										class="p-1.5 rounded-lg hover:bg-panel transition-colors"
										disabled={i === 0}
										onclick={() => moveMergeFile(i, -1)}
									>
										<ArrowUpIcon size="16" />
									</button>
									<button
										class="p-1.5 rounded-lg hover:bg-panel transition-colors"
										disabled={i === mergeFiles.length - 1}
										onclick={() => moveMergeFile(i, 1)}
									>
										<ArrowDownIcon size="16" />
									</button>
									<button
										class="p-1.5 rounded-lg hover:bg-panel transition-colors text-failure"
										onclick={() => removeMergeFile(i)}
									>
										<XIcon size="16" />
									</button>
								</div>
							</div>
						{/each}
					</div>

					<div class="flex justify-between items-center mt-2">
						<p class="text-sm text-muted">
							{mergeFiles.length} file{mergeFiles.length !== 1 ? "s" : ""}
							· {Array.from(mergeFilePageCounts.values()).reduce(
								(a, b) => a + b,
								0,
							)} total pages
						</p>
						<button
							class="btn {$effects ? '' : '!scale-100'} highlight flex gap-2"
							disabled={mergeFiles.length < 2 || mergeProcessing}
							onclick={handleMerge}
						>
							<FileDownIcon size="20" />
							{mergeProcessing ? "Merging…" : "Merge & Download"}
						</button>
					</div>
				{/if}
			</Panel>
		</div>
	{/if}

	<!-- Split Panel -->
	{#if activeMode === "split"}
		<div class="max-w-[778px] w-full flex flex-col gap-4">
			<Panel class="flex flex-col gap-4 p-5">
				<div class="flex items-center justify-between">
					<h2 class="text-xl font-bold flex items-center gap-2">
						<ScissorsIcon size="24" class="text-accent" />
						Split PDF
					</h2>
					<Tooltip text="Upload a PDF to split" position="left">
						<button
							class="btn {$effects ? '' : '!scale-100'} flex gap-2"
							onclick={() => splitInput?.click()}
						>
							<FileUpIcon size="20" />
							{splitFile ? "Change File" : "Upload PDF"}
						</button>
					</Tooltip>
				</div>

				<input
					bind:this={splitInput}
					type="file"
					accept=".pdf,application/pdf"
					class="hidden"
					onchange={handleSplitUpload}
				/>

				{#if !splitFile}
					<div
						class="flex flex-col items-center justify-center py-12 text-muted"
					>
						<ScissorsIcon size="48" class="mb-3 opacity-40" />
						<p class="text-lg font-medium">No file selected</p>
						<p class="text-sm">Upload a PDF and specify page ranges to split</p>
					</div>
				{:else}
					<div class="bg-panel-alt rounded-xl px-4 py-3 flex items-center gap-3">
						<div class="flex-1 min-w-0">
							<p class="font-medium truncate">{splitFile.name}</p>
							<p class="text-sm text-muted">
								{formatBytes(splitFile.size)} · {splitPageCount} pages
							</p>
						</div>
						<button
							class="p-1.5 rounded-lg hover:bg-panel transition-colors text-failure"
							onclick={() => {
								splitFile = null;
								splitPageCount = 0;
								splitRanges = "";
							}}
						>
							<XIcon size="16" />
						</button>
					</div>

					<div class="flex flex-col gap-2">
						<p class="text-sm font-bold">Page Ranges</p>
						<p class="text-xs text-muted">
							Separate ranges with semicolons. Examples: <code
								class="bg-panel-alt px-1 rounded">1-5</code
							>,
							<code class="bg-panel-alt px-1 rounded">1-3;6;9-12</code
							>,
							<code class="bg-panel-alt px-1 rounded">1-50</code
							>
							(each range becomes a separate file)
						</p>
						<input
							type="text"
							class="w-full bg-panel-alt rounded-xl px-4 py-3 font-mono text-sm outline-none focus:ring-2 focus:ring-accent transition-shadow"
							placeholder="e.g. 1-3;4-6;7-{splitPageCount}"
							bind:value={splitRanges}
						/>
					</div>

					<div class="flex justify-end mt-2">
						<button
							class="btn {$effects ? '' : '!scale-100'} highlight flex gap-2"
							disabled={!splitRanges.trim() || splitProcessing}
							onclick={handleSplit}
						>
							<FileDownIcon size="20" />
							{splitProcessing ? "Splitting…" : "Split & Download"}
						</button>
					</div>
				{/if}
			</Panel>
		</div>
	{/if}

	<!-- Compress Panel -->
	{#if activeMode === "compress"}
		<div class="max-w-[778px] w-full flex flex-col gap-4">
			<Panel class="flex flex-col gap-4 p-5">
				<div class="flex items-center justify-between">
					<h2 class="text-xl font-bold flex items-center gap-2">
						<GaugeIcon size="24" class="text-accent" />
						Compress PDF
					</h2>
					<Tooltip text="Upload a PDF to compress" position="left">
						<button
							class="btn {$effects ? '' : '!scale-100'} flex gap-2"
							onclick={() => compressInput?.click()}
						>
							<FileUpIcon size="20" />
							{compressFile ? "Change File" : "Upload PDF"}
						</button>
					</Tooltip>
				</div>

				<input
					bind:this={compressInput}
					type="file"
					accept=".pdf,application/pdf"
					class="hidden"
					onchange={handleCompressUpload}
				/>

				{#if !compressFile}
					<div
						class="flex flex-col items-center justify-center py-12 text-muted"
					>
						<GaugeIcon size="48" class="mb-3 opacity-40" />
						<p class="text-lg font-medium">No file selected</p>
						<p class="text-sm">Upload a PDF to reduce its file size</p>
					</div>
				{:else}
					<div class="bg-panel-alt rounded-xl px-4 py-3 flex items-center gap-3">
						<div class="flex-1 min-w-0">
							<p class="font-medium truncate">{compressFile.name}</p>
							<p class="text-sm text-muted">
								Size: {formatBytes(compressOriginalSize)}
							</p>
						</div>
						<button
							class="p-1.5 rounded-lg hover:bg-panel transition-colors text-failure"
							onclick={() => {
								compressFile = null;
								compressOriginalSize = 0;
							}}
						>
							<XIcon size="16" />
						</button>
					</div>

					<div class="flex flex-col gap-2">
						<label class="flex items-center gap-3 cursor-pointer">
							<input
								type="checkbox"
								class="w-4 h-4 accent-accent rounded"
								bind:checked={compressStripMetadata}
							/>
							<div>
								<p class="text-sm font-bold">Strip metadata</p>
								<p class="text-xs text-muted">
									Remove title, author, and other metadata to save additional
									space
								</p>
							</div>
						</label>
					</div>

					<div class="flex justify-end mt-2">
						<button
							class="btn {$effects ? '' : '!scale-100'} highlight flex gap-2"
							disabled={compressProcessing}
							onclick={handleCompress}
						>
							<FileDownIcon size="20" />
							{compressProcessing ? "Compressing…" : "Compress & Download"}
						</button>
					</div>
				{/if}
			</Panel>
		</div>
	{/if}
</div>
