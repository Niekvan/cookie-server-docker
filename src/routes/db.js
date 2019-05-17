const utils = require('../utils');
const mysql = require('mysql');

const updateDb = async (data, meta) => {
  const results = {};
  if (data.company === 'NULL') {
    data.company = "'undefined'";
  } else {
    const cm = await query(
      `INSERT INTO testcompany (name) SELECT * FROM (SELECT ${
        data.company
      }) AS tmp WHERE NOT EXISTS (SELECT id FROM testcompany WHERE name=${
        data.company
      })`
    );
    results.cm = cm;
  }
  if (meta && meta.address) {
    const l = await query(
      `INSERT INTO testlocation (address, country, latitude, longtitude, type) SELECT * FROM (SELECT ${mysql.escape(
        meta.address
      )}, ${mysql.escape(meta.components.country_code)}, ${
        meta.geometry.lat
      }, ${meta.geometry.lng}, ${mysql.escape(
        meta.components._type
      )}) AS tmp WHERE NOT EXISTS (SELECT id from testlocation WHERE (address=${mysql.escape(
        meta.address
      )} AND latitude=${meta.geometry.lat} AND longtitude=${
        meta.geometry.lng
      } AND type=${mysql.escape(meta.components._type)}))`
    );
    const locationId = await query(
      `SELECT id FROM testlocation WHERE address=${mysql.escape(
        meta.address
      )} AND country=${mysql.escape(
        meta.components.country_code
      )} AND latitude=${meta.geometry.lat} AND longtitude=${
        meta.geometry.lng
      } AND type=${mysql.escape(meta.components._type)}`
    );
    const d = await query(
      `INSERT INTO testdomain (name, location_id, company_id) SELECT * FROM (SELECT ${
        data.domain
      }, ${locationId[0].id}, id FROM testcompany WHERE name=${
        data.company
      }) AS tmp WHERE NOT EXISTS (SELECT id FROM testdomain WHERE name=${
        data.domain
      })`
    );
    results.l = l;
    results.d = d;
  } else {
    const d = await query(
      `INSERT INTO testdomain (name, company_id) SELECT * FROM (SELECT ${
        data.domain
      }, id FROM testcompany WHERE name=${
        data.company
      }) AS tmp WHERE NOT EXISTS (SELECT id FROM testdomain WHERE name=${
        data.domain
      })`
    );
    results.d = d;
  }
  const s = await query(
    `INSERT INTO testsubdomain (name, domain_id) SELECT * FROM (SELECT ${
      data.sub_domain
    }, id FROM testdomain WHERE name = ${
      data.domain
    }) AS tmp WHERE NOT EXISTS (SELECT id FROM testsubdomain WHERE name=${
      data.sub_domain
    })`
  );
  const w = await query(
    `INSERT INTO websites (name) SELECT(${
      data.website
    }) WHERE NOT EXISTS(SELECT id from websites WHERE name=${data.website})`
  );
  const c = await query(
    `INSERT INTO identifiercookie (name, value, identifier, subdomain_id, website_id) 
        SELECT * FROM (
          SELECT ${data.cookie}, ${data.value}, ${data.id}, 
          (SELECT id FROM testsubdomain WHERE name=${data.sub_domain}), 
          id FROM websites WHERE name=${data.website}
        ) AS tmp 
        WHERE NOT EXISTS (
          SELECT id FROM identifiercookie WHERE value=${data.value} 
          AND name=${data.cookie} 
          AND identifier=${data.id} 
          AND (SELECT id from websites WHERE websites.name=${data.website})
          AND time_added=CURRENT_TIMESTAMP
        )`
  );
  return {
    results: {
      s,
      c,
      w,
      ...results
    }
  };
};

const newEntry = async data => {
  const meta = await utils.requestWhoIs(data.domain);
  client.set(data.domain, JSON.stringify(meta));
  data.company = meta.company;
  utils.escapeObject(data);
  const { results } = await updateDb(data, meta);
  return {
    results: {
      ...results
    }
  };
};

const getCookies = async identifier => {
  if (identifier) {
    const sqlString = `SELECT c.name AS cookie, c.value, s.name AS sub_domain, d.name AS domain, cm.name AS company, w.name AS website, l.country, l.latitude, l.longtitude
    FROM duplicatecookies c 
    INNER JOIN testsubdomain s ON c.subdomain_id=s.id
    LEFT JOIN websites w ON c.website_id=w.id
    INNER JOIN testdomain d ON s.domain_id=d.id
    INNER JOIN testcompany cm ON d.company_id=cm.id
    LEFT join testlocation l ON d.location_id=l.id
    WHERE c.identifier='${identifier}'`;
    const data = await query(sqlString);
    return data;
  }
  return { error: 'no identifier' };
};

const cookieEntries = async data => {
  const domain = data.domain;
  const existing = await getAsync(domain);
  if (existing) {
    utils.escapeObject(data);
    const c = await query(
      `INSERT INTO identifiercookie (name, value, identifier, subdomain_id) SELECT * FROM (SELECT ${
        data.cookie
      }, ${data.value}, ${data.id}, id FROM testsubdomain WHERE name = ${
        data.sub_domain
      }) AS tmp WHERE NOT EXISTS (SELECT id FROM identifiercookie WHERE value=${
        data.value
      } AND name=${data.cookie})`
    );
    return {
      results: {
        c
      }
    };
  }
  return {
    results: 'no hierarchy'
  };
};

const processDomain = async cookieData => {
  const domain = cookieData.domain;
  const existing = await getAsync(domain);
  if (existing != null) {
    console.log('cache', domain);
    const cacheData = JSON.parse(existing);
    cookieData.company = cacheData.company;
    if (!cacheData.company) {
      console.log('cache empty');
      const { results: entry } = await newEntry(cookieData);
      return entry;
    }
    utils.escapeObject(cookieData);
    const { results: update } = await updateDb(cookieData, cacheData);
    return update;
  }
  console.log('new', domain);
  const { results: entry } = await newEntry(cookieData);
  return entry;
};

const getConnections = async ({ type, entry }) => {
  let selector;
  switch (type) {
    case 'visited':
      selector = 'w';
      break;
    case 'connected':
      selector = 'w';
      break;
    case 'companies':
      selector = 'cm';
      break;
    case 'domains':
      selector = 'd';
      break;
    case 'subDomains':
      selector = 's';
      break;
    case 'cookies':
      selector = 'c';
      break;
  }
  try {
    const data = await query(`SELECT c.name AS cookie, s.name AS subDomain, d.name AS domain, cm.name AS company, w.name AS visited 
                              FROM duplicatecookies c, testsubdomain s, testdomain d, testcompany cm, websites w 
                              WHERE c.subdomain_id=s.id 
                                AND s.domain_id=d.id 
                                AND d.company_id=cm.id 
                                AND c.website_id=w.id
                                AND ${selector}.name='${entry}'`);

    const companies = data
      .map(item => item.company)
      .filter((item, index, array) => array.indexOf(item) === index);

    let promises = [];
    companies.forEach(company => {
      promises.push(
        query(`SELECT w.name AS connected FROM duplicatecookies c, testsubdomain s, testdomain d, testcompany cm, websites w
                WHERE c.subdomain_id=s.id 
                  AND s.domain_id=d.id 
                  AND d.company_id=cm.id 
                  AND c.website_id=w.id
                  AND cm.name='${company}'
                GROUP BY w.name`)
      );
    });

    const connected = await Promise.all(promises);
    const merged = [].concat.apply([], connected);

    return {
      connected: merged,
      data
    };
  } catch (error) {
    return error;
  }
};

module.exports = {
  updateDb,
  newEntry,
  cookieEntries,
  processDomain,
  getCookies,
  getConnections
};
