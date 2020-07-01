"use strict";
const { sanitizeEntity } = require("strapi-utils");

/**
 * Read the documentation (https://strapi.io/documentation/3.0.0-beta.x/concepts/controllers.html#core-controllers)
 * to customize this controller
 */

const NO_INTEGRATION = 0
const CATS_INTEGRATION = 1
const GOOGLE_SPREADSHEETS_INTEGRATION = 2

module.exports = {
  async refresh(ctx) {
    const { id: assignmentGroupId } = ctx.params;
    const {
      integration_type: integrationType,
      integrationUrl,
      sheetName,
      upperLeftCell,
      lowerRightCell,
    } = await strapi.services["assignment-group"].findOne({
      id: assignmentGroupId,
    });

    let result = {};
    if (integrationType.code === NO_INTEGRATION) {
      return {}
    } else if (integrationType.code === CATS_INTEGRATION) {
      result = await strapi.services["assignment-group"].getCatsResults(integrationUrl);
    } else if (integrationType.code === GOOGLE_SPREADSHEETS_INTEGRATION) {
      result = await strapi.services["assignment-group"].getGoogleSpreadsheetResults({integrationUrl, sheetName, upperLeftCell, lowerRightCell});
    }

    const { assignments, studentItems } = await strapi.services[
      "assignment-group"
    ].getExistingDataForImportPreparation(assignmentGroupId);

    let assignmentIds = [];
    for (let title of result.taskTitles) {
      const assignment = assignments.find((a) => a.title === title);
      if (assignment) {
        assignmentIds.push(assignment.id);
      } else {
        const newAssignment = { title, assignment_group: assignmentGroupId };
        const createdAssignment = await strapi.services["assignment"].create(
          newAssignment
        );
        assignmentIds.push(createdAssignment.id);
      }
    }

    let studentIds = [];
    for (let studentFullName of result.students) {
      const [familyName, name, patronymic] = studentFullName.trim().split(" ");
      let filtered = studentItems.filter(
        (x) => x.user.familyName === familyName && x.user.name === name
      );
      if (patronymic && filtered.length > 1) {
        filtered = filtered.filter((x) => x.user.patronymic === patronymic);
      }

      studentIds.push(filtered && filtered[0] ? filtered[0].id : null);
    }

    let marks = [];
    for (let studentIdx = 0; studentIdx < studentIds.length; studentIdx++) {
      for (
        let assignmentIdx = 0;
        assignmentIdx < assignmentIds.length;
        assignmentIdx++
      ) {
        const studentId = studentIds[studentIdx];
        const assignmentId = assignmentIds[assignmentIdx];
        if (!studentId || !assignmentId) {
          continue;
        }

        const mark = await strapi.services["mark"].performMutation(
          studentId,
          assignmentId,
          result.marksTable[studentIdx][assignmentIdx]
        );
        marks.push(mark);
      }
    }

    return { marks, studentIds, assignmentIds, result };
  },
};
