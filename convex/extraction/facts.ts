import { v, type Infer } from 'convex/values';
import {
	cardCandidates,
	emailCandidates,
	eventDateCandidates,
	fulfillmentSignal,
	type Fulfillment
} from '../checks/candidates';
import type { DocumentText } from './candidates';

type Question =
	| { type: 'noul'; instructions: unknown }
	| { type: 'choice'; instructions: unknown; criteria: Record<string, unknown> };
type Answer =
	| { type: 'choice'; choice: string; probabilities: Record<string, number>; confidence: number }
	| { type: 'noul'; noul: number };

const none = 'none';
const factThreshold = 0.7;
const maxStoredText = 3000;

export const fulfillmentOptions = {
	delivered: 'The document shows the items were delivered or picked up',
	shipped: 'The document shows the items have shipped but not arrived yet',
	pending:
		'An order confirmation, pre-order, or a future "Arriving" or "Estimated delivery" date; nothing has shipped yet',
	in_person:
		'Bought in person at a store, or a digital product, subscription, or service that is not shipped'
} as const satisfies Record<Fulfillment, string>;

export const documentFacts = v.object({
	itemized: v.boolean(),
	cardLast4: v.union(v.string(), v.null()),
	fulfillment: v.union(
		v.literal('delivered'),
		v.literal('shipped'),
		v.literal('pending'),
		v.literal('in_person'),
		v.null()
	),
	food: v.boolean(),
	mentionsFood: v.boolean(),
	eventDates: v.array(v.string()),
	dates: v.array(v.string()),
	approverEmail: v.union(v.string(), v.null()),
	text: v.string()
});

export type DocumentFacts = Infer<typeof documentFacts>;

export type FactsPlan = {
	cards: string[];
	eventDates: string[];
	emails: string[];
};

export function factQuestions(text: DocumentText): {
	questions: Record<string, Question>;
	plan: FactsPlan;
} {
	const cards = cardCandidates(text.lines);
	const dates = eventDateCandidates(text.lines);
	const emails = emailCandidates(text.lines);
	const questions: Record<string, Question> = {
		itemized: {
			type: 'noul',
			instructions:
				'Does `document` list the individual items or services that were bought by name? A card payment slip that only shows a total is not itemized.'
		},
		fulfillment: {
			type: 'choice',
			instructions: 'What does `document` show about how the purchased items reached the buyer?',
			criteria: fulfillmentOptions
		},
		food: {
			type: 'noul',
			instructions:
				'Does `document` show food or drinks being bought, such as snacks, groceries, pizza, coffee, or catering?'
		},
		mentions_food: {
			type: 'noul',
			instructions:
				'Does `document` tell people that food, snacks, drinks, or refreshments will be provided?'
		}
	};
	if (cards.length > 0) {
		questions.card_last4 = {
			type: 'choice',
			instructions:
				'Which option is the last four digits of the payment card used for this purchase? Not a merchant ID, order number, phone number, transaction number, or reference number.',
			criteria: {
				...Object.fromEntries(cards.map((card) => [card.digits, { appears_on_lines: card.lines }])),
				[none]: 'None of these are the last four digits of the card that paid.'
			}
		};
	}
	dates.forEach((candidate, index) => {
		questions[`event_date_${index}`] = {
			type: 'noul',
			instructions: {
				date: candidate.written,
				appears_on_lines: candidate.lines,
				question:
					'Is `date` a day when the event, meeting, or activity described in `document` takes place? Not a purchase date, posting date, deadline, or printed date.'
			}
		};
	});
	if (emails.length > 0) {
		questions.approver_email = {
			type: 'choice',
			instructions:
				'Which email address belongs to the person who wrote the approval in `document`? Not the person asking for approval.',
			criteria: {
				...Object.fromEntries(emails.map((email) => [email, null])),
				[none]: 'Nobody in `document` gives an approval.'
			}
		};
	}
	return {
		questions,
		plan: {
			cards: cards.map((card) => card.digits),
			eventDates: dates.map((candidate) => candidate.date),
			emails
		}
	};
}

export function parseFacts(
	plan: FactsPlan,
	text: DocumentText,
	answers: Record<string, Answer | undefined>,
	items: string[]
): DocumentFacts {
	const yes = (key: string) => {
		const answer = answers[key];
		return answer?.type === 'noul' && answer.noul >= factThreshold;
	};
	return {
		itemized: items.length > 0 || yes('itemized'),
		cardLast4: picked(answers.card_last4, plan.cards, 0.5),
		fulfillment: fulfillment(text.lines, answers.fulfillment),
		food: yes('food'),
		mentionsFood: yes('mentions_food'),
		eventDates: plan.eventDates.filter((_, index) => yes(`event_date_${index}`)),
		dates: plan.eventDates,
		approverEmail: picked(answers.approver_email, plan.emails, 0.5),
		text: text.lines.join('\n').slice(0, maxStoredText)
	};
}

function picked(answer: Answer | undefined, options: string[], floor: number) {
	if (answer?.type !== 'choice' || answer.choice === none) return null;
	if (!options.includes(answer.choice)) return null;
	return (answer.probabilities[answer.choice] ?? 0) >= floor ? answer.choice : null;
}

function fulfillment(lines: string[], answer: Answer | undefined): Fulfillment | null {
	const signal = fulfillmentSignal(lines);
	if (signal === 'delivered' || signal === 'shipped') return signal;
	const choice =
		answer?.type === 'choice' && answer.choice in fulfillmentOptions
			? (answer.choice as Fulfillment)
			: null;
	const probability =
		choice === null || answer?.type !== 'choice' ? 0 : answer.probabilities[choice];
	if (signal === 'pending') {
		return choice !== null && choice !== 'pending' && choice !== 'in_person' && probability >= 0.85
			? choice
			: 'pending';
	}
	return choice !== null && probability >= factThreshold ? choice : null;
}
