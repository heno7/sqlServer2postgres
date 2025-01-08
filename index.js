document.getElementById('clearBtn').addEventListener('click', function () {
    document.getElementById('sqlInput').value = '';
    document.getElementById('sqlOutput').value = '';
});

document.getElementById("convertBtn").addEventListener("click", function () {
    let sqlInput = document.getElementById("sqlInput").value;
    let sqlOutput = document.getElementById("sqlOutput");

    let convertedSql = convertSql(sqlInput);

    sqlOutput.value = convertedSql;
});

function convertSql(sql) {
    // Normalize SQL keywords to uppercase, case-insensitive matching
    sql = sql.replace(/\b(delete|insert|update|select|from|where|inner join|left join|right join|create table|drop table|alter table|merge|output|using|returning|on conflict|values|set|limit|top|distinct|as|join|on|group by|order by|having|union|like|in|not in|is|null|exists|select distinct|all)\b/gi, function (match) {
        return match.toUpperCase();
    });

    // Handle DML Statements
    sql = handleDmlStatements(sql);

    // Handle Data Type Conversion
    sql = handleDataTypes(sql);

    // Handle Built-in Function Conversion
    sql = handleFunctions(sql);

    // Handle Table Management
    sql = sql.replace(/\bcreate table\b/gi, 'CREATE TABLE');
    sql = sql.replace(/\bdrop table\b/gi, 'DROP TABLE');
    sql = sql.replace(/\balter table\b/gi, 'ALTER TABLE');

    // Handle Select INTO (SQL Server to PostgreSQL conversion)
    sql = sql.replace(/\bselect into\b/gi, 'CREATE TABLE AS SELECT');

    // Handle Select with Top (SQL Server to PostgreSQL conversion)
    sql = sql.replace(/\bselect top (\d+)\b/gi, 'SELECT $1');

    // Handle Insert INTO with Values
    sql = sql.replace(/\binsert into \S+ (.+) values \((.+)\)/gi, 'INSERT INTO $1 ($2) VALUES ($3) RETURNING *;');

    // Handle Merge (SQL Server to PostgreSQL conversion, for UPSERTs)
    sql = sql.replace(/\bmerge into\b/gi, 'INSERT INTO');
    sql = sql.replace(/\bwhen matched then\b/gi, 'ON CONFLICT DO UPDATE');
    sql = sql.replace(/\bwhen not matched then\b/gi, 'ON CONFLICT DO NOTHING');

    // Handle Delete Statement (SQL Server to PostgreSQL conversion)
    sql = handleDeleteStatements(sql);

    // Handle Functions, Stored Procedures, and Triggers (Basic placeholders for now)
    sql = handleFunctionsAndStoredProcedures(sql);

    return sql;
}

function handleDmlStatements(sql) {
    // Insert Statements
    sql = sql.replace(/\binsert into\b/gi, 'INSERT INTO');

    // Update Statements
    sql = sql.replace(/\bupdate\b/gi, 'UPDATE');

    // Delete Statements
    sql = handleDeleteStatements(sql);

    return sql;
}

function handleDeleteStatements(sql) {
    // Handle DELETE without FROM (SQL Server allows this; PostgreSQL requires FROM)
    // Example: DELETE test -> DELETE FROM test
    sql = sql.replace(/\bdelete\s+(\S+)(\s+where|\s*$)/gi, 'DELETE FROM $1$2');

    // Handle DELETE with FROM (complex DELETE with joins or subqueries)
    // Example: DELETE e FROM employees e INNER JOIN departments d ON e.department_id = d.department_id
    sql = sql.replace(/\bdelete\s+(\S+)\s+from\s+(\S+)/gi, 'DELETE FROM $2 USING $2 WHERE $1');

    // Handle DELETE with OUTPUT (SQL Server) to RETURNING (PostgreSQL)
    // Example: DELETE FROM employees OUTPUT deleted.id -> DELETE FROM employees RETURNING id
    sql = sql.replace(/\bdelete from (\S+)\s+output deleted\.(\w+)/gi, 'DELETE FROM $1 RETURNING $2');

    return sql;
}

function handleDataTypes(sql) {
    // CHAR(n), NCHAR(n)
    sql = sql.replace(/\bNCHAR\s*\(\s*(\d+)\s*\)/gi, 'CHAR($1)');
    sql = sql.replace(/\bCHAR\s*\(\s*(\d+)\s*\)/gi, 'CHAR($1)');

    // NTEXT, NVARCHAR(n), NVARCHAR(MAX)
    sql = sql.replace(/\bNTEXT\b/gi, 'TEXT');
    sql = sql.replace(/\bNVARCHAR\s*\(\s*(\d+)\s*\)/gi, 'VARCHAR($1)');
    sql = sql.replace(/\bNVARCHAR\s*\(MAX\)/gi, 'TEXT');

    // TEXT, VARCHAR(n), VARCHAR(MAX)
    sql = sql.replace(/\bTEXT\b/gi, 'TEXT');
    sql = sql.replace(/\bVARCHAR\s*\(\s*(\d+)\s*\)/gi, 'VARCHAR($1)');
    sql = sql.replace(/\bVARCHAR\s*\(MAX\)/gi, 'TEXT');

    // FLOAT(p), SMALLMONEY, TINYINT
    sql = sql.replace(/\bFLOAT\s*\(\s*(\d+)\s*\)/gi, (match, p) => {
        return parseInt(p) > 24 ? 'DOUBLE PRECISION' : 'REAL';
    });
    sql = sql.replace(/\bSMALLMONEY\b/gi, 'MONEY');
    sql = sql.replace(/\bTINYINT\b/gi, 'SMALLINT');

    // DATETIME, DATETIME2(p), DATETIMEOFFSET(p), SMALLDATETIME
    sql = sql.replace(/\bDATETIME\b/gi, 'TIMESTAMP');
    sql = sql.replace(/\bDATETIME2\s*\(\s*(\d+)\s*\)/gi, 'TIMESTAMP($1)');
    sql = sql.replace(/\bDATETIMEOFFSET\s*\(\s*(\d+)\s*\)/gi, 'TIMESTAMP($1) WITH TIME ZONE');
    sql = sql.replace(/\bSMALLDATETIME\b/gi, 'TIMESTAMP(0)');

    // BINARY(n), VARBINARY(n), VARBINARY(MAX)
    sql = sql.replace(/\bBINARY\s*\(\s*(\d+)\s*\)/gi, 'BYTEA');
    sql = sql.replace(/\bVARBINARY\s*\(\s*(\d+)\s*\)/gi, 'BYTEA');
    sql = sql.replace(/\bVARBINARY\s*\(MAX\)/gi, 'BYTEA');

    // BIT, IMAGE, ROWVERSION, TIMESTAMP
    sql = sql.replace(/\bBIT\b/gi, 'BOOLEAN');
    sql = sql.replace(/\bIMAGE\b/gi, 'BYTEA');
    sql = sql.replace(/\bROWVERSION\b/gi, 'BYTEA');
    // sql = sql.replace(/\bTIMESTAMP\b/gi, 'BYTEA');

    // UNIQUEIDENTIFIER
    sql = sql.replace(/\bUNIQUEIDENTIFIER\b/gi, 'UUID');

    return sql;
}



function handleFunctions(sql) {
    // SQL Server to PostgreSQL Built-in Function Conversion
    const functionMap = {
        'GETDATE()': 'CURRENT_TIMESTAMP',
        'GETUTCDATE()': 'CURRENT_TIMESTAMP',
        'SYSDATETIME()': 'CURRENT_TIMESTAMP',
        'LEN()': 'LENGTH()',
        'ISNULL()': 'COALESCE()',
        'ISNULL': 'COALESCE',
        'GETDATE': 'CURRENT_TIMESTAMP',
        'DATEADD': 'DATE + INTERVAL',
        'DATEDIFF': 'DATE_PART',
        'NEWID()': 'UUID_GENERATE_V4()',
        'CAST': 'CAST',
        'CONVERT': 'CAST',
        'GETDATE': 'CURRENT_TIMESTAMP',
        'CHARINDEX': 'POSITION',
        'REPLACE': 'REPLACE',
        'SUBSTRING': 'SUBSTRING'
    };

    Object.keys(functionMap).forEach(function (key) {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        sql = sql.replace(regex, functionMap[key]);
    });

    return sql;
}

function handleFunctionsAndStoredProcedures(sql) {
    // Example: Handling SQL Server to PostgreSQL function conversion
    sql = sql.replace(/\bcreate function\b/gi, 'CREATE FUNCTION');
    sql = sql.replace(/\bdrop function\b/gi, 'DROP FUNCTION');
    sql = sql.replace(/\balter function\b/gi, 'ALTER FUNCTION');

    // For stored procedures, convert SQL Server's style to PostgreSQL's
    sql = sql.replace(/\bcreate procedure\b/gi, 'CREATE PROCEDURE');
    sql = sql.replace(/\bdrop procedure\b/gi, 'DROP PROCEDURE');
    sql = sql.replace(/\balter procedure\b/gi, 'ALTER PROCEDURE');

    // Trigger handling (basic conversion for now)
    sql = sql.replace(/\bcreate trigger\b/gi, 'CREATE TRIGGER');
    sql = sql.replace(/\bdrop trigger\b/gi, 'DROP TRIGGER');

    return sql;
}
