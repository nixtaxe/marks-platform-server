'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/3.0.0-beta.x/concepts/services.html#core-services)
 * to customize this service
 */

module.exports = {
  async performMutation(studentId, assignmentId, value) {
    const [mark] = await strapi.services['mark'].find({student: studentId, assignment: assignmentId})
    if (mark) {
      if (value === '') {
        await strapi.services['mark'].delete({id: mark.id})
        return null
      } else {
        return await strapi.services['mark'].update({id: mark.id }, {value})
      }
    } else {
      if (value === '') {
        return null
      } else {
        return await strapi.services['mark'].create({student: studentId, assignment: assignmentId, value})
      }
    }
  }
};
