// main.js

// Get the API Gateway base URL from your config object
const apiUrl = window.EMPLOYEE_CONFIG.API_GW_BASE_URL_STR;

// ---------- Fetch Top 10 Employees ----------
document.getElementById("fetchTop10Btn").addEventListener("click", () => {
    fetch(`${apiUrl}/employees/top_10`)
        .then(response => response.json())
        .then(result => {
            console.log("Received result:", result);

            // Parse the actual payload from result.body
            const payload = JSON.parse(result.body);
            const employees = payload.data;  // array of employee objects

            // Display the data source (e.g., "Cached" or "rds")
            const dataSourceDiv = document.getElementById("dataSource");
            dataSourceDiv.textContent = "Data Source: " + result.source || "Unknown";

            // Clear any existing rows in the table body
            const tbody = document.querySelector("#employeeTable tbody");
            tbody.innerHTML = "";

            // Map over each employee and create a table row
            employees.forEach(emp => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>${emp.emp_no}</td>
                    <td>${emp.first_name}</td>
                    <td>${emp.last_name}</td>
                    <td>${emp.dept_name}</td>
                    <td>${emp.max_salary}</td>
                `;
                tbody.appendChild(row);
            });
        })
        .catch(error => console.error("Error fetching top 10 employees:", error));
});



// ---------- Create Employee ---------- //
document.getElementById("createForm").addEventListener("submit", (e) => {
    e.preventDefault(); // Prevent default form submission

    // Gather form data into a payload
    const formData = new FormData(e.target);
    const payload = Object.fromEntries(formData.entries());
    const jsonData = JSON.stringify(payload);
    console.log(jsonData);

    // POST /employees/create to create a new employee
    fetch(`${apiUrl}/employees/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: jsonData
    })
        .then(response => response.json())
        .then(data => {
            // Check if the returned JSON contains a non-200 statusCode
            if (data.statusCode && data.statusCode !== 200) {
                let errorMsg;
                try {
                    // Attempt to parse the error from data.body
                    const errorBody = JSON.parse(data.body);
                    errorMsg = errorBody.error;
                } catch (err) {
                    errorMsg = data.body;
                }
                throw new Error(errorMsg || 'Create failed');
            }
            alert("Employee created successfully!");
            e.target.reset(); // Clear the form
            console.log("Server response:", data);
        })
        .catch(error => {
            console.error("Error creating employee:", error);
            alert(`Error creating employee: ${error.message}`);
        });
});


// ---------- Read Employee ---------- //
document.getElementById("readForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const empNo = new FormData(e.target).get("emp_no");

    // GET /employees/{empNo} to read a specific employee
    fetch(`${apiUrl}/employees/${empNo}`)
        .then(response => response.json())
        .then(data => {
            // Check if the API returned a non-200 status (e.g., 404 for "not found")
            if (data.statusCode && data.statusCode !== 200) {
                // Show an alert with the error message
                const message = data.body || data.message || 'Unknown error';
                alert(`Error: ${JSON.parse(data.body).message}`);
                return;
            }

            // Parse the employee object from data.body (which is a JSON string)
            const employee = JSON.parse(data.body);

            // Debug: console.log(employee) to verify field names
            console.log("Employee:", employee);

            // Show the table and populate it with the returned data
            const table = document.getElementById("readEmployeeTable");
            const tbody = document.getElementById("readEmployeeTableBody");

            // Clear any existing row (in case of multiple reads)
            tbody.innerHTML = "";

            // Create a new row
            const row = document.createElement("tr");

            // Insert columns based on the actual fields returned by your Lambda
            const empNoCell = document.createElement("td");
            empNoCell.textContent = employee.emp_no;
            row.appendChild(empNoCell);

            const firstNameCell = document.createElement("td");
            firstNameCell.textContent = employee.first_name;
            row.appendChild(firstNameCell);

            const lastNameCell = document.createElement("td");
            lastNameCell.textContent = employee.last_name;
            row.appendChild(lastNameCell);

            // Your response JSON has "dept_name" rather than "department"
            const departmentCell = document.createElement("td");
            departmentCell.textContent = employee.dept_name;
            row.appendChild(departmentCell);

            const maxSalaryCell = document.createElement("td");
            maxSalaryCell.textContent = employee.max_salary;
            row.appendChild(maxSalaryCell);

            // Append the row to the table body
            tbody.appendChild(row);

            // Make the table visible
            table.style.display = "table";
        })
        .catch(error => {
            console.error("Error reading employee:", error);
            alert("Error reading employee. Check console for details.");
        });
});



// ---------- Update Employee ---------- //
document.getElementById("updateForm").addEventListener("submit", (e) => {
    e.preventDefault();

    // Collect form data
    const formData = new FormData(e.target);
    const empNo = formData.get("emp_no");  // The path param
    const payload = Object.fromEntries(formData.entries());

    // Remove emp_no from the payload, since it's part of the path, not the body
    delete payload.emp_no;

    // PUT /employees/{empNo} to update employee details
    fetch(`${apiUrl}/employees/${empNo}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        // Check for a non-200 status code (if your API returns statusCode)
        if (data.statusCode && data.statusCode !== 200) {
            alert(`Error updating employee: ${data.body || data.message || 'Unknown error'}`);
        } else {
            alert("Employee updated successfully!");
            e.target.reset();
        }
    })
    .catch(error => {
        console.error("Error updating employee:", error);
        alert("Error updating employee. Check console for details.");
    });
});


// ---------- Delete Employee ---------- //
document.getElementById("deleteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const empNo = new FormData(e.target).get("emp_no");

    fetch(`${apiUrl}/employees/${empNo}`, {
        method: "DELETE"
    })
        .then(response => response.json())
        .then(data => {
            // Check if the response contains a statusCode and it's not 200.
            if (data.statusCode && data.statusCode !== 200) {
                let errorMsg;
                try {
                    // Attempt to parse the error message from the "body" field.
                    const errorBody = JSON.parse(data.body);
                    errorMsg = errorBody.message;
                } catch (err) {
                    errorMsg = data.body;
                }
                throw new Error(errorMsg || 'Error deleting employee');
            }
            alert("Employee deleted successfully!");
            e.target.reset();
        })
        .catch(error => {
            alert(`Error deleting employee: ${error.message}`);
            console.error("Error deleting employee:", error);
        });
});




