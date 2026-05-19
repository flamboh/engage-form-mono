export default defineContentScript({
	matches: ['https://uoregon.campuslabs.com/engage/submitter/form/*'],
	main() {
		const state = window as Window & { __engageFormWxtContentLoaded?: boolean };
		state.__engageFormWxtContentLoaded = true;
	}
});
