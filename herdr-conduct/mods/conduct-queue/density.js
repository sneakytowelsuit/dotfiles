import { shared } from "herdr";

export const SPACING = Object.freeze({
  comfortable: Object.freeze({
    rowX: 10, rowY: 7, cardGap: 4, headingGap: 9, detailGap: 6, cardMinHeight: 32,
    titleSize: 12, lineSize: 11, detailSize: 10, badgeSize: 9,
    lineX: 8, lineY: 4, lineGap: 8, primaryY: 6, primaryMargin: 10,
    tabHeight: 34, tabTextSize: 12, inboxGap: 12, inboxCardPadding: 12,
  }),
  compact: Object.freeze({
    rowX: 8, rowY: 4, cardGap: 2, headingGap: 6, detailGap: 4, cardMinHeight: 26,
    titleSize: 11, lineSize: 10, detailSize: 9, badgeSize: 9,
    lineX: 6, lineY: 2, lineGap: 5, primaryY: 3, primaryMargin: 6,
    tabHeight: 28, tabTextSize: 11, inboxGap: 8, inboxCardPadding: 8,
  }),
});

export function density() {
  return shared("conduct.density") === "compact" ? "compact" : "comfortable";
}
