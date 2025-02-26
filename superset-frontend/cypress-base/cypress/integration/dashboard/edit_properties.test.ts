/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

// eslint-disable-next-line import/no-extraneous-dependencies
import * as ace from 'brace';
import * as shortid from 'shortid';
import { USA_BIRTH_NAMES_DASHBOARD } from './dashboard.helper';

function selectColorScheme(color: string) {
  // open color scheme dropdown
  cy.get('.ant-modal-body')
    .contains('Color scheme')
    .parents('.ControlHeader')
    .next('.ant-select')
    .click()
    .then($colorSelect => {
      // select a new color scheme
      cy.wrap($colorSelect).find(`[data-test="${color}"]`).click();
    });
}

function assertMetadata(text: string) {
  const regex = new RegExp(text);
  cy.get('.ant-modal-body')
    .find('#json_metadata')
    .should('be.visible')
    .then(() => {
      const metadata = cy.$$('#json_metadata')[0];

      // cypress can read this locally, but not in ci
      // so we have to use the ace module directly to fetch the value
      expect(ace.edit(metadata).getValue()).to.match(regex);
    });
}
function clear(input: string) {
  cy.get(input).type('{selectall}{backspace}');
}
function type(input: string, text: string) {
  cy.get(input).type(text, { parseSpecialCharSequences: false });
}

function openAdvancedProperties() {
  return cy
    .get('.ant-modal-body')
    .contains('Advanced')
    .should('be.visible')
    .click();
}

function openDashboardEditProperties() {
  // open dashboard properties edit modal
  cy.get(
    '.header-with-actions .right-button-panel .ant-dropdown-trigger',
  ).trigger('click', {
    force: true,
  });
  cy.get('[data-test=header-actions-menu]')
    .contains('Edit properties')
    .click({ force: true });
}

describe('Dashboard edit action', () => {
  beforeEach(() => {
    cy.login();
    cy.visit(USA_BIRTH_NAMES_DASHBOARD);
    cy.intercept(`/api/v1/dashboard/births`).as('dashboardGet');
    cy.get('.dashboard-grid', { timeout: 50000 })
      .should('be.visible') // wait for 50 secs to load dashboard
      .then(() => {
        cy.get('.header-with-actions [aria-label="Edit dashboard"]')
          .should('be.visible')
          .click();
        openDashboardEditProperties();
      });
  });

  it('should update the title', () => {
    const dashboardTitle = `Test dashboard [${shortid.generate()}]`;

    // update title
    cy.get('.ant-modal-body')
      .should('be.visible')
      .contains('Title')
      .get('[data-test="dashboard-title-input"]')
      .type(`{selectall}{backspace}${dashboardTitle}`);

    // save edit changes
    cy.get('.ant-modal-footer')
      .contains('Apply')
      .click()
      .then(() => {
        // assert that modal edit window has closed
        cy.get('.ant-modal-body').should('not.exist');

        // assert title has been updated
        cy.get('[data-test="editable-title-input"]').should(
          'have.value',
          dashboardTitle,
        );
      });
  });
  describe('the color picker is changed', () => {
    describe('the metadata has a color scheme', () => {
      describe('the advanced tab is open', () => {
        it('should overwrite the color scheme', () => {
          openAdvancedProperties();
          selectColorScheme('d3Category20b');
          assertMetadata('d3Category20b');
        });
      });
      describe('the advanced tab is not open', () => {
        it('should overwrite the color scheme', () => {
          selectColorScheme('bnbColors');
          openAdvancedProperties();
          assertMetadata('bnbColors');
        });
      });
    });
  });
  describe('a valid colorScheme is entered', () => {
    it('should save json metadata color change to dropdown', () => {
      // edit json metadata
      openAdvancedProperties().then(() => {
        clear('#json_metadata');
        type('#json_metadata', '{"color_scheme":"d3Category20"}');
      });

      // save edit changes
      cy.get('.ant-modal-footer')
        .contains('Apply')
        .click()
        .then(() => {
          // assert that modal edit window has closed
          cy.get('.ant-modal-body').should('not.exist');

          // assert color has been updated
          openDashboardEditProperties();
          openAdvancedProperties().then(() => {
            assertMetadata('d3Category20');
          });
          cy.get('.ant-select-selection-item .color-scheme-option').should(
            'have.attr',
            'data-test',
            'd3Category20',
          );
        });
    });
  });
  describe('an invalid colorScheme is entered', () => {
    it('should throw an error', () => {
      // edit json metadata
      openAdvancedProperties().then(() => {
        clear('#json_metadata');
        type('#json_metadata', '{"color_scheme":"THIS_DOES_NOT_WORK"}');
      });

      // save edit changes
      cy.get('.ant-modal-footer')
        .contains('Apply')
        .click()
        .then(() => {
          // assert that modal edit window has closed
          cy.get('.ant-modal-body')
            .contains('A valid color scheme is required')
            .should('be.visible');
        });

      cy.on('uncaught:exception', err => {
        expect(err.message).to.include('something about the error');

        // return false to prevent the error from
        // failing this test
        return false;
      });
    });
  });
  describe.skip('the color scheme affects the chart colors', () => {
    it('should change the chart colors', () => {
      openAdvancedProperties().then(() => {
        clear('#json_metadata');
        type(
          '#json_metadata',
          '{"color_scheme":"lyftColors", "label_colors": {}}',
        );
      });

      cy.get('.ant-modal-footer')
        .contains('Apply')
        .click()
        .then(() => {
          cy.get('.ant-modal-body').should('not.exist');
          // assert that the chart has changed colors
          cy.get('.line .nv-legend-symbol')
            .first()
            .should('have.css', 'fill', 'rgb(117, 96, 170)');
        });
    });
    it('the label colors should take precedence over the scheme', () => {
      openAdvancedProperties().then(() => {
        clear('#json_metadata');
        type(
          '#json_metadata',
          '{"color_scheme":"lyftColors","label_colors":{"Amanda":"red"}}',
        );
      });

      cy.get('.ant-modal-footer')
        .contains('Apply')
        .click()
        .then(() => {
          cy.get('.ant-modal-body').should('not.exist');
          // assert that the chart has changed colors
          cy.get('.line .nv-legend-symbol')
            .first()
            .should('have.css', 'fill', 'rgb(255, 0, 0)');
        });
    });
    it('the shared label colors and label colors are applied correctly', () => {
      openAdvancedProperties().then(() => {
        clear('#json_metadata');
        type(
          '#json_metadata',
          '{"color_scheme":"lyftColors","label_colors":{"Amanda":"red"}}',
        );
      });

      cy.get('.ant-modal-footer')
        .contains('Apply')
        .click()
        .then(() => {
          cy.get('.ant-modal-body').should('not.exist');
          // assert that the chart has changed colors
          cy.get('.line .nv-legend-symbol')
            .first()
            .should('have.css', 'fill', 'rgb(255, 0, 0)'); // label: amanda
          cy.get('.line .nv-legend-symbol')
            .eq(11)
            .should('have.css', 'fill', 'rgb(234, 11, 140)'); // label: jennifer
          cy.get('.word_cloud')
            .first()
            .find('svg text')
            .first()
            .should('have.css', 'fill', 'rgb(234, 11, 140)'); // label: jennifer
        });
    });
  });
});
