const Memcached = require('memcached');
const mysql = require('mysql2/promise');

// Replace with your Memcached endpoint and port
const memcached = new Memcached('cache02.jbgwl6.cfg.use1.cache.amazonaws.com:11211');

exports.handler = async (event) => {
    const cacheKey = 'top10_employees';

    try {
        // Attempt to retrieve data from cache
        const cachedData = await getCache(cacheKey);
        if (cachedData) {
            console.log('Cache hit: returning cached top 10 employees.');
            return {
                statusCode: 200,
                body: JSON.stringify({
                    data: cachedData,
                }),
                source: 'Cached'
            };
        }
    } catch (err) {
        console.error('Error accessing cache:', err);
    }

    // Cache miss; execute the actual query
    const top10Employees = await fetchTop10Employees();

    // Cache the query result for 20 seconds
    try {
        await setCache(cacheKey, top10Employees, 20);
    } catch (err) {
        console.error('Error setting cache:', err);
    }

    return {
        statusCode: 200,
        body: JSON.stringify({
            data: top10Employees
        }),
        source: 'RDS'
    };
};

// Helper function to get cached data from Memcached
function getCache(key) {
    return new Promise((resolve, reject) => {
        memcached.get(key, (err, data) => {
            if (err) return reject(err);
            resolve(data);
        });
    });
}

// Helper function to set data in Memcached
function setCache(key, value, lifetime) {
    return new Promise((resolve, reject) => {
        memcached.set(key, value, lifetime, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
}

// Function to fetch top 10 employees from the MySQL database
async function fetchTop10Employees() {
    // Create a connection to your MySQL database using environment variables
    const connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,        // e.g., your RDS endpoint
        user: process.env.MYSQL_USER,        // e.g., admin
        password: process.env.MYSQL_PASSWORD, // your password
        database: process.env.MYSQL_DB       // e.g., employees
    });

    const query = `
        SELECT e.emp_no, e.first_name, e.last_name, d.dept_name, MAX(s.salary) AS max_salary 
        FROM employees e 
        JOIN dept_emp de ON e.emp_no = de.emp_no 
        JOIN departments d ON de.dept_no = d.dept_no 
        JOIN (SELECT emp_no, salary FROM salaries WHERE to_date = '9999-01-01') s 
        ON e.emp_no = s.emp_no 
        WHERE s.salary > (SELECT AVG(salary) FROM salaries) 
        GROUP BY e.emp_no, e.first_name, e.last_name, d.dept_name 
        ORDER BY max_salary DESC 
        LIMIT 10;
    `;

    try {
        const [rows, fields] = await connection.execute(query);
        console.log('Data fetched from RDS');
        return rows;
    } catch (err) {
        console.error('Error executing query:', err);
        throw err;
    } finally {
        await connection.end();
    }
}
