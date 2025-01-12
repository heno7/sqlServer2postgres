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

    // Handle Built-in Function Conversion
    sql = handleBuiltInFunctions(sql);

    // Handle Identifiers
    sql = handleIdentifiers(sql);

    // Handle Language Elements
    sql = handleLanguageElements(sql);

    // Handle Data Type Conversion
    sql = handleDataTypes(sql);

    // Handle DML Statements
    sql = handleDmlStatements(sql);

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

function handleIdentifiers(sql) {
    // Convert temporary tables (#table) to PostgreSQL format
    sql = sql.replace(/^#(\w+)/g, 'temp_$1');

    // Quote identifiers with special characters
    sql = sql.replace(/(\b\w*#\w*\b)/g, '"$1"');

    sql = sql.replace(/\[([^\]]+)\]/g, '$1');

    return sql;
}

function handleLanguageElements(sql) {
    // Convert single-quoted aliases to double-quoted aliases
    sql = sql.replace(/\bAS\s+'([^']+)'/gi, 'AS "$1"');
    sql = sql.replace(/(\w+)\s+'([^']+)'/gi, '$1 AS "$2"');

    // Convert single-quoted aliases without AS keyword to double-quoted aliases
    sql = sql.replace(/(\w+)\s+'([^']+)'/gi, '$1 AS "$2"');

    // Convert single-quoted strings followed by single-quoted aliases without AS keyword
    sql = sql.replace(/'([^']+)' '([^']+)'/gi, "'$1' \"$2\"");

    // Convert @@ROWCOUNT to ROW_COUNT
    sql = sql.replace(/@@ROWCOUNT/gi, 'ROW_COUNT');

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



function handleBuiltInFunctions(sql) {
    // Call the string functions handler
    sql = handleStringFunctions(sql);

    // Call the date/time functions handler
    sql = handleDateTimeFunctions(sql);
    // Future: Call other categories of built-in functions handlers here (e.g., date functions, aggregate functions)

    return sql;
}

function handleStringFunctions(sql) {
    // CHAR 
    sql = sql.replace(/\bCHAR\s*\(\s*(.*?)\s*\)/gi, 'CHR($1)');

    // NCHAR (convert hex like 0x20AC to decimal for PostgreSQL)
    sql = sql.replace(/\bNCHAR\s*\(\s*0x([0-9A-Fa-f]+)\s*\)/gi, (match, hex) => {
        const decimalValue = parseInt(hex, 16);
        return `CHR(${decimalValue})`;
    });
    sql = sql.replace(/\bNCHAR\s*\(\s*(.*?)\s*\)/gi, 'CHR($1)');

    // CHARINDEX with and without optional start position
    sql = sql.replace(/\bCHARINDEX\s*\(\s*'([^']+)'\s*,\s*'([^']+)'(?:\s*,\s*(\d+))?\s*\)/gi, (match, expressionToFind, expressionToSearch, startLocation) => {
        if (startLocation) {
            return `POSITION('${expressionToFind}' IN SUBSTRING('${expressionToSearch}' FROM ${startLocation})) + (${startLocation} - 1)`;
        } else {
            return `POSITION('${expressionToFind}' IN '${expressionToSearch}')`;
        }
    });

    // CONCAT
    sql = sql.replace(/\bCONCAT\s*\((.*?)\)/gi, 'CONCAT($1)');

    // CONVERT for VARCHAR(datetime, style)
    sql = sql.replace(/\bCONVERT\s*\(\s*VARCHAR\s*,\s*(.*?),\s*(\d+)\s*\)/gi, (match, datetime, style) => {
        // Handle style to format mapping
        const styleToFormat = {
            '101': 'MM/DD/YYYY',
            '102': 'YYYY.MM.DD',
            '103': 'DD/MM/YYYY',
            '120': 'YYYY-MM-DD HH24:MI:SS'
        };
        return `TO_CHAR(${datetime}, '${styleToFormat[style] || 'YYYY-MM-DD HH24:MI:SS'}')`;
    });

    // LEN
    sql = sql.replace(/\bLEN\s*\(\s*(.*?)\s*\)/gi, 'LENGTH(RTRIM($1))');

    // PATINDEX (approximation using POSITION)
    sql = sql.replace(/\bPATINDEX\s*\(\s*(.*?),\s*(.*?)\s*\)/gi, 'POSITION($1 IN $2)');

    // REPLICATE
    sql = sql.replace(/\bREPLICATE\s*\(\s*(.*?),\s*(.*?)\s*\)/gi, 'REPEAT($1, $2)');

    // REVERSE
    sql = sql.replace(/\bREVERSE\s*\(\s*(.*?)\s*\)/gi, 'REVERSE($1)');

    // STR
    sql = sql.replace(/\bSTR\s*\(\s*(.*?),\s*(\d+)(?:\s*,\s*(\d+))?\s*\)/gi, (match, num, length, decimals) => {
        const totalLength = parseInt(length, 10);
        const decimalPlaces = decimals ? parseInt(decimals, 10) : 0;

        // Create the PostgreSQL TO_CHAR format string
        const integerPartLength = totalLength - (decimalPlaces > 0 ? decimalPlaces + 1 : 0);
        const format = `'FM${'9'.repeat(integerPartLength)}${decimalPlaces > 0 ? '.' + '9'.repeat(decimalPlaces) : ''}'`;

        return `TO_CHAR(${num}, ${format})`;
    });

    // STRING_AGG
    sql = sql.replace(/\bSTRING_AGG\s*\((.*?),\s*(.*?)\s*\)/gi, 'STRING_AGG($1, $2)');

    // STRING_SPLIT
    sql = sql.replace(/\bSTRING_SPLIT\s*\(\s*(.*?),\s*(.*?)\s*\)/gi, (match, string, delimiter) => {
        return `UNNEST(string_to_array(${string}, ${delimiter}))`;
    });

    return sql;
}

function handleDateTimeFunctions(sql) {
    // CONVERT(DATETIME, expr, style)
    sql = sql.replace(/\bCONVERT\s*\(\s*DATETIME\s*,\s*(.*?),\s*(\d+)\s*\)/gi, (match, expr, style) => {
        const styleToFormat = {
            '101': 'MM/DD/YYYY',
            '102': 'YYYY.MM.DD',
            '103': 'DD/MM/YYYY',
            '112': 'YYYYMMDD',
            '110': 'MM/DD/YYYY HH24:MI:SS',
            '120': 'YYYY-MM-DD HH24:MI:SS',
        };
        return `TO_TIMESTAMP(${expr}, '${styleToFormat[style] || 'YYYY-MM-DD HH24:MI:SS'}')`;
    });

    // CURRENT_TIMESTAMP
    sql = sql.replace(/\bCURRENT_TIMESTAMP\b/gi, 'CURRENT_TIMESTAMP');

    // CONVERT(TIME, expr)
    sql = sql.replace(/\bCONVERT\s*\(\s*TIME\s*,\s*(.*?)\s*\)/gi, 'TO_CHAR($1, \'HH24:MI:SS\')');

    // DATEADD(unit, number, date)
    sql = sql.replace(/\bDATEADD\s*\(\s*([a-zA-Z_]+)\s*,\s*([^,]+)\s*,\s*(.+?)\)\s*/gi, (match, unit, number, date) => {
        console.log(date);

        const unitMapping = {
            'YEAR': 'year', 'Y': 'year', 'YY': 'year', 'YYYY': 'year',
            'MONTH': 'month', 'MM': 'month', 'M': 'month',
            'DAY': 'day', 'DD': 'day', 'D': 'day',
            'MINUTE': 'minute', 'MI': 'minute', 'N': 'minute',
            'SECOND': 'second', 'SS': 'second', 'S': 'second'
        };
        return `(${date} + INTERVAL '${number} ${unitMapping[unit.toUpperCase()] || unit}')`;
    });

    // DATEDIFF(units, start, end)
    sql = sql.replace(/\bDATEDIFF\s*\(\s*(\w+)\s*,\s*(.*?)\s*,\s*(.*?)\s*\)/gi, (match, units, start, end) => {
        const unitMapping = {
            'YEAR': 'YEAR', 'MONTH': 'MONTH', 'DAY': 'DAY',
            'HOUR': 'HOUR', 'MINUTE': 'MINUTE', 'SECOND': 'SECOND',
        };
        return `EXTRACT(EPOCH FROM (${end} - ${start})) / ${getSecondsInUnit(unitMapping[units.toUpperCase()] || units)}`;
    });

    // DATEDIFF_BIG(units, start, end)
    sql = sql.replace(/\bDATEDIFF_BIG\s*\(\s*(\w+)\s*,\s*(.*?)\s*,\s*(.*?)\s*\)/gi, (match, units, start, end) => {
        const unitMapping = {
            'YEAR': 'YEAR', 'MONTH': 'MONTH', 'DAY': 'DAY',
            'HOUR': 'HOUR', 'MINUTE': 'MINUTE', 'SECOND': 'SECOND',
        };
        return `EXTRACT(EPOCH FROM (${end} - ${start})) / ${getSecondsInUnit(unitMapping[units.toUpperCase()] || units)}`;
    });

    // DATENAME(unit, datetime)
    sql = sql.replace(/\bDATENAME\s*\(\s*(\w+)\s*,\s*(.*?)\s*\)/gi, (match, unit, datetime) => {
        const unitMapping = {
            'YEAR': 'YYYY', 'MONTH': 'Month', 'DAY': 'DD',
            'HOUR': 'HH24', 'MINUTE': 'MI', 'SECOND': 'SS'
        };
        return `TO_CHAR(${datetime}, '${unitMapping[unit.toUpperCase()] || unit}')`;
    });

    // DATEPART(unit, datetime)
    sql = sql.replace(/\bDATEPART\s*\(\s*(\w+)\s*,\s*(.*?)\s*\)/gi, (match, unit, datetime) => {
        const unitMapping = {
            'YEAR': 'YEAR', 'MONTH': 'MONTH', 'DAY': 'DAY',
            'HOUR': 'HOUR', 'MINUTE': 'MINUTE', 'SECOND': 'SECOND'
        };
        return `EXTRACT(${unitMapping[unit.toUpperCase()] || unit} FROM ${datetime})`;
    });

    // DAY(datetime)
    sql = sql.replace(/\bDAY\s*\(\s*(.*?)\s*\)/gi, 'EXTRACT(DAY FROM $1)');

    // GETDATE()
    sql = sql.replace(/\bGETDATE\s*\(\s*\)/gi, 'NOW()');

    // MONTH(datetime)
    sql = sql.replace(/\bMONTH\s*\(\s*(.*?)\s*\)/gi, 'EXTRACT(MONTH FROM $1)');

    // SYSDATETIMEOFFSET()
    sql = sql.replace(/\bSYSDATETIMEOFFSET\s*\(\s*\)/gi, 'CURRENT_TIMESTAMP AT TIME ZONE \'UTC\'');

    // YEAR(datetime)
    sql = sql.replace(/\bYEAR\s*\(\s*(.*?)\s*\)/gi, 'EXTRACT(YEAR FROM $1)');

    return sql;
}

function getSecondsInUnit(unit) {
    const unitToSeconds = {
        'YEAR': 31536000, // Approximate
        'MONTH': 2592000, // Approximate
        'DAY': 86400,
        'HOUR': 3600,
        'MINUTE': 60,
        'SECOND': 1
    };
    return unitToSeconds[unit.toUpperCase()] || 1;
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

console.log(handleDateTimeFunctions(`SELECT DATEADD(day, 1, GETDATE());`));
// console.log(convertSql(`SELECT CONVERT(DATETIME, '12/28/2022 11:13:31', 110);`));
