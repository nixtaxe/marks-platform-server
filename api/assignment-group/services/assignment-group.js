"use strict";
const puppeteer = require("puppeteer");
const { getSpreadsheetData } = require("./google_spreadsheet");

/**
 * Read the documentation (https://strapi.io/documentation/3.0.0-beta.x/concepts/services.html#core-services)
 * to customize this service
 */

module.exports = {
  async getExistingDataForImportPreparation(assignmentGroupId) {
    const assignmentGroup = await strapi.services["assignment-group"].findOne({
      id: assignmentGroupId,
    });

    const assignments = assignmentGroup.assignments;

    const tdsgId =
      assignmentGroup.semester_discipline.teacher_discipline_student_group;
    const tdsg = await strapi.services[
      "teacher-discipline-student-group"
    ].findOne({ id: tdsgId });

    const studentGroupId = tdsg.student_group.id;
    const studentGroup = await strapi.services["student-group"].findOne({
      id: studentGroupId,
    });

    let studentItems = [];
    for (let student of studentGroup.students) {
      const user = await strapi.plugins[
        "users-permissions"
      ].services.user.fetch({ id: student.user });
      studentItems.push({ id: student.id, user });
    }

    return { assignments, studentItems };
  },
  async getCatsResults(url) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    try {
      await page.goto(url, { waitUntil: "networkidle2" });

      let results = {};

      const [contestTitleHandler] = await page.$x(
        "/html/body/table[1]/tbody/tr/td[2]"
      );
      results.contestTitle = await contestTitleHandler.evaluate((x) =>
        x.textContent.trim()
      );

      const taskTitleHandlers = await page.$x(
        "/html/body/div/span[2]/table[2]/tbody/tr/th/a"
      );
      results.taskTitles = [];
      for (let x of taskTitleHandlers) {
        results.taskTitles.push(await x.evaluate((y) => y.title.trim()));
      }

      const studentHandlers = await page.$x(
        "/html/body/div/span[2]/table[2]/tbody/tr/td[2]"
      );
      studentHandlers.pop();
      results.students = [];
      for (let x of studentHandlers) {
        results.students.push(await x.evaluate((y) => y.textContent.trim()));
      }

      const markHandlers = await page.$x(
        "/html/body/div/span[2]/table[2]/tbody/" +
          `tr[position() >= 2 and position() <= ${
            results.students.length + 2
          }]/` +
          `td[position() >= 3 and position() <= ${
            results.taskTitles.length + 3
          }]/a`
      );
      const isUndone = new RegExp("[.]");
      const wasSucessfullyDone = new RegExp("\\+|^[^0.\\-]+");
      results.marksTable = [];
      for (let i = 0; i < results.students.length; i++) {
        results.marksTable.push([]);
        for (let j = 0; j < results.taskTitles.length; j++) {
          const mark = await markHandlers[
            i * results.taskTitles.length + j
          ].evaluate((y) => y.textContent.trim());
          if (isUndone.test(mark)) results.marksTable[i].push("");
          else if (wasSucessfullyDone.test(mark))
            results.marksTable[i].push("1");
          else results.marksTable[i].push("0");
        }
      }

      return results;
    } catch (e) {
      console.log(e);
    } finally {
      browser.close();
    }
  },

  async getGoogleSpreadsheetResults(data) {
    return await getSpreadsheetData(data);
  },
};
