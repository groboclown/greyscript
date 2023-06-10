// Test string formatting.

//#require errors.gs
//#require tests.gs
//#require format/formatted-str.gs

TestPyFormat_no_format = function(t)
    t.Expect(FormatStr.PyFormat("1 2 3", {"1": "x"})).ToBe("1 2 3")
end function

TestPyFormat_single_replacement = function(t)
    t.Expect(FormatStr.PyFormat("{x}", {"x": "abc", "y": 2})).ToBe("abc")
end function

if locals == globals then T.RunTests