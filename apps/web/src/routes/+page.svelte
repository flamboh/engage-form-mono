<script lang="ts">
  import { onMount } from "svelte";
  import DemoCard from "$lib/landing/DemoCard.svelte";
  import { LOOP_MS, TICK_MS } from "$lib/landing/demo";

  let t = $state(0);

  onMount(() => {
    const id = setInterval(() => {
      t = (t + TICK_MS) % LOOP_MS;
    }, TICK_MS);

    return () => clearInterval(id);
  });
</script>

<svelte:head>
  <title>Engage Form</title>
  <meta
    name="description"
    content="Engage Form fills your purchase requests on Engage for you."
  />
</svelte:head>

<main class="flex min-h-screen flex-col bg-background text-foreground">
  <header class="border-b border-border/70">
    <div class="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
      <span class="font-heading text-lg font-semibold tracking-tight">Engage Form</span>
      <a class="text-sm text-muted-foreground transition-colors hover:text-foreground" href="/">
        Sign in
      </a>
    </div>
  </header>

  <section class="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-10 px-6 py-10 md:py-14">
    <div class="flex max-w-2xl flex-col items-center gap-5 text-center">
      <h1 class="font-heading text-4xl leading-[1.05] font-semibold tracking-tight md:text-5xl">
        Defeat SOFS form fatigue.
      </h1>
      <p class="text-base text-muted-foreground md:text-lg">
        Engage Form fills your purchase requests on Engage for you.
      </p>
      <div class="flex flex-wrap items-center justify-center gap-4">
        <a
          class="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          href="/"
        >
          Get started
        </a>
        <span class="text-sm text-muted-foreground">Free for ASUO-recognized groups.</span>
      </div>
    </div>

    <div class="grid w-full gap-4 md:grid-cols-2">
      <DemoCard title="You" kind="you" {t} />
      <DemoCard title="Form Agent" kind="agent" {t} accent />
    </div>
  </section>
</main>
