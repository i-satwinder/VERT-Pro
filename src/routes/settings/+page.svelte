<script lang="ts">
	import { browser } from "$app/environment";
	import { log, error } from "$lib/util/logger";
	import * as Settings from "$lib/sections/settings/index.svelte";
	import * as About from "$lib/sections/about";
	import { PUB_PLAUSIBLE_URL } from "$env/static/public";
	import { SettingsIcon, InfoIcon } from "lucide-svelte";
	import { onMount } from "svelte";
	import { m } from "$lib/paraglide/messages";
	import { ToastManager } from "$lib/util/toast.svelte";
	import { DISABLE_ALL_EXTERNAL_REQUESTS, GITHUB_API_URL } from "$lib/util/consts";
	import { base } from "$app/paths";
	import avatarNullptr from "$lib/assets/avatars/nullptr.jpg";
	import avatarLiam from "$lib/assets/avatars/liam.jpg";
	import avatarJovannMC from "$lib/assets/avatars/jovannmc.jpg";
	import avatarRealmy from "$lib/assets/avatars/realmy.jpg";
	import avatarAzurejelly from "$lib/assets/avatars/azurejelly.jpg";

	interface Contributor {
		name: string;
		github: string;
		avatar: string;
		role?: string;
	}

	const mainContribs: Contributor[] = [
		{
			name: "nullptr",
			github: "https://github.com/not-nullptr",
			role: m["about.credits.roles.lead_developer"](),
			avatar: avatarNullptr,
		},
		{
			name: "JovannMC",
			github: "https://github.com/JovannMC",
			role: m["about.credits.roles.developer"](),
			avatar: avatarJovannMC,
		},
		{
			name: "Liam",
			github: "https://x.com/z2rMC",
			role: m["about.credits.roles.designer"](),
			avatar: avatarLiam,
		},
	];

	const notableContribs: Contributor[] = [
		{
			name: "azurejelly",
			github: "https://github.com/azurejelly",
			role: m["about.credits.roles.docker_ci"](),
			avatar: avatarAzurejelly,
		},
		{
			name: "Realmy",
			github: "https://github.com/RealmyTheMan",
			role: m["about.credits.roles.former_cofounder"](),
			avatar: avatarRealmy,
		},
	];

	let ghContribs: Contributor[] = [];

	let settings = $state(Settings.Settings.instance.settings);

	let isInitial = $state(true);

	$effect(() => {
		if (!browser) return;
		if (isInitial) {
			isInitial = false;
			return;
		}

		const savedSettings = localStorage.getItem("settings");
		if (savedSettings) {
			const parsedSettings = JSON.parse(savedSettings);
			if (JSON.stringify(parsedSettings) === JSON.stringify(settings))
				return;
		}

		try {
			Settings.Settings.instance.settings = settings;
			Settings.Settings.instance.save();
			log(["settings"], "saving settings");
		} catch (error) {
			log(["settings", "error"], `failed to save settings: ${error}`);
			ToastManager.add({
				type: "error",
				message: m["settings.errors.save_failed"](),
			});
		}
	});

	onMount(async () => {
		const savedSettings = localStorage.getItem("settings");
		if (savedSettings) {
			const parsedSettings = JSON.parse(savedSettings);
			Settings.Settings.instance.settings = {
				...Settings.Settings.instance.settings,
				...parsedSettings,
			};
			settings = Settings.Settings.instance.settings;
		}

		// Fetch GitHub contributors
		if (!DISABLE_ALL_EXTERNAL_REQUESTS) {
			const cachedContribs = sessionStorage.getItem("ghContribs");
			if (cachedContribs) {
				ghContribs = JSON.parse(cachedContribs);
				return;
			}

			try {
				const response = await fetch(`${GITHUB_API_URL}/contributors`);
				if (!response.ok) {
					ToastManager.add({
						type: "error",
						message: m["about.errors.github_contributors"](),
					});
					throw new Error(`HTTP error, status: ${response.status}`);
				}
				const allContribs = await response.json();

				const excludedNames = new Set([
					...mainContribs.map((c) => c.github.split("/").pop()),
					...notableContribs.map((c) => c.github.split("/").pop()),
					"Z2r-YT",
				]);

				const filteredContribs = allContribs.filter(
					(contrib: { login: string }) =>
						!excludedNames.has(contrib.login),
				);

				const fetchAvatar = async (url: string) => {
					const res = await fetch(url);
					const blob = await res.blob();
					return new Promise<string>((resolve, reject) => {
						const reader = new FileReader();
						reader.onloadend = () => resolve(reader.result as string);
						reader.onerror = reject;
						reader.readAsDataURL(blob);
					});
				};

				ghContribs = await Promise.all(
					filteredContribs.map(
						async (contrib: {
							login: string;
							avatar_url: string;
							html_url: string;
						}) => ({
							name: contrib.login,
							avatar: await fetchAvatar(contrib.avatar_url),
							github: contrib.html_url,
						}),
					),
				);

				sessionStorage.setItem("ghContribs", JSON.stringify(ghContribs));
			} catch (e) {
				error(["general"], `Error fetching GitHub contributors: ${e}`);
			}
		}
	});
</script>

<div class="flex flex-col h-full items-center">
	<h1 class="hidden md:block text-[40px] tracking-tight leading-[72px] mb-6">
		<SettingsIcon size="40" class="inline-block -mt-2 mr-2" />
		{m["settings.title"]()}
	</h1>

	<div
		class="w-full max-w-[1280px] flex flex-col md:flex-row gap-4 p-4 md:px-4 md:py-0"
	>
		<div class="flex flex-col gap-4 flex-1">
			<Settings.Conversion bind:settings />
			{#if !DISABLE_ALL_EXTERNAL_REQUESTS}
				<Settings.Vertd bind:settings />
			{:else if PUB_PLAUSIBLE_URL}
				<Settings.Privacy bind:settings />
			{/if}
		</div>

		<div class="flex flex-col gap-4 flex-1">
			<Settings.Appearance />
			{#if PUB_PLAUSIBLE_URL && !DISABLE_ALL_EXTERNAL_REQUESTS}
				<Settings.Privacy bind:settings />
			{/if}

			<!-- About Section -->
			<div class="flex flex-col gap-4">
				<About.Why />
				<About.Resources />
				<About.Credits {mainContribs} {notableContribs} {ghContribs} />
				<a
					href="{base}/about/"
					class="btn flex items-center justify-center gap-2 p-4 rounded-full bg-button text-black dynadark:text-white"
				>
					<InfoIcon size="20" />
					{m["navbar.about"]()}
				</a>
			</div>
		</div>
	</div>
</div>
